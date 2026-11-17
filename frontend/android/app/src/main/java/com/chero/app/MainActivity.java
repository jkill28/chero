package com.chero.app;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private long lastBackPressTime = 0;
    private static final long DOUBLE_BACK_INTERVAL_MS = 2000;
    private int lastTopSafePx = 44;
    private int lastBottomSafePx = 16;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        configureImmersiveCutoutWindow();
        setupSafeAreaInsetsBridge();

        if (getBridge() != null) {
            getBridge().addWebViewListener(new WebViewListener() {
                @Override
                public void onPageCommitVisible(WebView view, String url) {
                    super.onPageCommitVisible(view, url);
                    pushSafeAreaCssVariables();
                }

                @Override
                public void onPageLoaded(WebView webView) {
                    super.onPageLoaded(webView);
                    pushSafeAreaCssVariables();
                }
            });
        }

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView != null) {
                    webView.evaluateJavascript(
                        "(function() { return window.__cheroHandleBack ? window.__cheroHandleBack() : 'EXIT'; })()",
                        result -> {
                            if ("\"MODAL_CLOSED\"".equals(result)) {
                                lastBackPressTime = 0;
                                return;
                            }
                            handleDoubleBackExit(result);
                        }
                    );
                } else {
                    handleDoubleBackExit(null);
                }
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        enableImmersiveSystemBars();
        pushSafeAreaCssVariables();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enableImmersiveSystemBars();
            pushSafeAreaCssVariables();
        }
    }

    private void configureImmersiveCutoutWindow() {
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);

        WindowManager.LayoutParams lp = window.getAttributes();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        window.setAttributes(lp);

        enableImmersiveSystemBars();
    }

    private void enableImmersiveSystemBars() {
        Window window = getWindow();
        View decorView = window.getDecorView();
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decorView);
        if (controller != null) {
            controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
            controller.hide(WindowInsetsCompat.Type.systemBars());
        }
    }

    private void setupSafeAreaInsetsBridge() {
        View decorView = getWindow().getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(decorView, (v, insets) -> {
            Insets cutoutAndStatus = insets.getInsetsIgnoringVisibility(
                WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.statusBars()
            );
            Insets navInsets = insets.getInsetsIgnoringVisibility(
                WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.navigationBars()
            );
            Insets imeInsets = insets.getInsets(WindowInsetsCompat.Type.ime());
            boolean imeVisible = insets.isVisible(WindowInsetsCompat.Type.ime());

            // Keep top/left/right padding at 0 so the WebView surface fills behind the camera cutout edge-to-edge;
            // only adjust bottom padding when the soft keyboard is open so inputs remain visible.
            v.setPadding(0, 0, 0, imeVisible ? imeInsets.bottom : 0);

            float density = getResources().getDisplayMetrics().density;
            if (density <= 0f) density = 1f;

            // Ensure at least 36dp top clearance on phones even if system reports 0 while transitioning
            int computedTopDp = Math.round(cutoutAndStatus.top / density);
            lastTopSafePx = Math.max(computedTopDp, 36);
            lastBottomSafePx = Math.max(Math.round(navInsets.bottom / density), 12);

            pushSafeAreaCssVariables();
            return WindowInsetsCompat.CONSUMED;
        });
    }

    private void pushSafeAreaCssVariables() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }
        final int topPx = lastTopSafePx;
        final int bottomPx = lastBottomSafePx;
        getBridge().executeOnMainThread(() -> {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                String js = String.format(
                    Locale.US,
                    "try { document.documentElement.style.setProperty('--safe-area-top', '%dpx'); document.documentElement.style.setProperty('--safe-area-bottom', '%dpx'); } catch (e) {}",
                    topPx,
                    bottomPx
                );
                webView.evaluateJavascript(js, null);
            }
        });
    }

    private void handleDoubleBackExit(String jsResult) {
        long now = System.currentTimeMillis();
        if (now - lastBackPressTime < DOUBLE_BACK_INTERVAL_MS) {
            finish();
        } else {
            lastBackPressTime = now;
            if (jsResult == null || "null".equals(jsResult) || "\"EXIT\"".equals(jsResult)) {
                Toast.makeText(this, "Press back again to exit", Toast.LENGTH_SHORT).show();
            }
        }
    }
}
