package com.chero.app;

import android.os.Bundle;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private long lastBackPressTime = 0;
    private static final long DOUBLE_BACK_INTERVAL_MS = 2000;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

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
