package com.weshlameche.chero;

import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
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
    private int lastTopSafePx = 36;
    private int lastBottomSafePx = 20;
    private Boolean overrideLightAppearance = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        configureMaterialEdgeToEdgeWindow();
        setupSafeAreaInsetsBridge();

        if (getBridge() != null) {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.addJavascriptInterface(new CheroNativeBridge(), "CheroNative");
            }
            getBridge().addWebViewListener(new WebViewListener() {
                @Override
                public void onPageCommitVisible(WebView view, String url) {
                    super.onPageCommitVisible(view, url);
                    pushSafeAreaCssVariables();
                    syncSystemBarsWithWebTheme();
                }

                @Override
                public void onPageLoaded(WebView webView) {
                    super.onPageLoaded(webView);
                    pushSafeAreaCssVariables();
                    syncSystemBarsWithWebTheme();
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
        applyMaterialEdgeToEdgeSystemBars();
        pushSafeAreaCssVariables();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyMaterialEdgeToEdgeSystemBars();
            pushSafeAreaCssVariables();
        }
    }

    private void configureMaterialEdgeToEdgeWindow() {
        Window window = getWindow();
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        WindowCompat.setDecorFitsSystemWindows(window, false);

        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }

        WindowManager.LayoutParams lp = window.getAttributes();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        window.setAttributes(lp);

        applyMaterialEdgeToEdgeSystemBars();
    }

    private void applyMaterialEdgeToEdgeSystemBars() {
        Window window = getWindow();
        View decorView = window.getDecorView();
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decorView);
        if (controller != null) {
            controller.show(WindowInsetsCompat.Type.systemBars());
            boolean isLight = resolveIsLightAppearance();
            controller.setAppearanceLightStatusBars(isLight);
            controller.setAppearanceLightNavigationBars(isLight);
        }
    }

    private boolean resolveIsLightAppearance() {
        if (overrideLightAppearance != null) {
            return overrideLightAppearance;
        }
        int nightModeFlags = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return nightModeFlags != Configuration.UI_MODE_NIGHT_YES;
    }

    private void syncSystemBarsWithWebTheme() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;
        webView.evaluateJavascript(
            "(function() { return document.documentElement.classList.contains('dark') ? 'dark' : 'light'; })()",
            result -> {
                if ("\"dark\"".equals(result)) {
                    overrideLightAppearance = false;
                } else if ("\"light\"".equals(result)) {
                    overrideLightAppearance = true;
                }
                applyMaterialEdgeToEdgeSystemBars();
            }
        );
    }

    private class CheroNativeBridge {
        @JavascriptInterface
        public void setSystemBarsLightAppearance(final boolean isLight) {
            runOnUiThread(() -> {
                overrideLightAppearance = isLight;
                applyMaterialEdgeToEdgeSystemBars();
            });
        }
    }

    private void setupSafeAreaInsetsBridge() {
        View decorView = getWindow().getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(decorView, (v, insets) -> {
            Insets topInsets = insets.getInsets(
                WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.displayCutout()
            );
            Insets navInsets = insets.getInsets(
                WindowInsetsCompat.Type.navigationBars() | WindowInsetsCompat.Type.displayCutout()
            );
            Insets imeInsets = insets.getInsets(WindowInsetsCompat.Type.ime());
            boolean imeVisible = insets.isVisible(WindowInsetsCompat.Type.ime());

            // Keep top/left/right padding at 0 so the WebView surface flows edge-to-edge behind
            // the transparent status bar and gesture bar; only pad bottom when the keyboard is open.
            v.setPadding(0, 0, 0, imeVisible ? imeInsets.bottom : 0);

            float density = getResources().getDisplayMetrics().density;
            if (density <= 0f) density = 1f;

            int computedTopDp = Math.round(topInsets.top / density);
            int computedBottomDp = Math.round(navInsets.bottom / density);

            lastTopSafePx = Math.max(computedTopDp, 28);
            lastBottomSafePx = Math.max(computedBottomDp, 16);

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
