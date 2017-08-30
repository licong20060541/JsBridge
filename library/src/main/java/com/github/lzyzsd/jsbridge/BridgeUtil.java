package com.github.lzyzsd.jsbridge;

import android.content.Context;
import android.util.Base64;
import android.webkit.WebView;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;

public class BridgeUtil {
	final static String YY_OVERRIDE_SCHEMA = "yy://";
	final static String YY_RETURN_DATA = YY_OVERRIDE_SCHEMA + "return/";//格式为   yy://return/{function}/returncontent
	final static String YY_FETCH_QUEUE = YY_RETURN_DATA + "_fetchQueue/";
	final static String EMPTY_STR = "";
	final static String UNDERLINE_STR = "_";
	final static String SPLIT_MARK = "/";
	
	final static String CALLBACK_ID_FORMAT = "JAVA_CB_%s";
	final static String JS_HANDLE_MESSAGE_FROM_JAVA = "javascript:WebViewJavascriptBridge._handleMessageFromNative('%s');";
	final static String JS_FETCH_QUEUE_FROM_JAVA = "javascript:WebViewJavascriptBridge._fetchQueue();";
	public final static String JAVASCRIPT_STR = "javascript:";
	
	public static String parseFunctionName(String jsUrl){
		// 如 "javascript:WebViewJavascriptBridge._fetchQueue();"
		// -- "_fetchQueue();" -- "_fetchQueue"
		return jsUrl.replace("javascript:WebViewJavascriptBridge.", "").replaceAll("\\(.*\\);", "");
	}
	
	
	public static String getDataFromReturnUrl(String url) {
		if(url.startsWith(YY_FETCH_QUEUE)) {
			return url.replace(YY_FETCH_QUEUE, EMPTY_STR);
		}
		
		String temp = url.replace(YY_RETURN_DATA, EMPTY_STR);
		String[] functionAndData = temp.split(SPLIT_MARK);

        if(functionAndData.length >= 2) {
            StringBuilder sb = new StringBuilder();
            for (int i = 1; i < functionAndData.length; i++) {
                sb.append(functionAndData[i]);
            }
            return sb.toString();
        }
		return null;
	}

	public static String getFunctionFromReturnUrl(String url) {
		String temp = url.replace(YY_RETURN_DATA, EMPTY_STR);
		String[] functionAndData = temp.split(SPLIT_MARK);
		if(functionAndData.length >= 1){
			return functionAndData[0];
		}
		return null;
	}

	
	
	/**
	 * js 文件将注入为第一个script引用
	 * @param view
	 * @param url
	 */
	public static void webViewLoadJs(WebView view, String url){
		String js = "var newscript = document.createElement(\"script\");";
		js += "newscript.src=\"" + url + "\";";
		js += "document.scripts[0].parentNode.insertBefore(newscript,document.scripts[0]);";
		view.loadUrl("javascript:" + js);
	}

    public static void webViewLoadLocalJs(WebView view, String path){
        String jsContent = assetFile2Str(view.getContext(), path);
        view.loadUrl("javascript:" + jsContent);
    }
	
	public static String assetFile2Str(Context c, String urlStr){
		InputStream in = null;
		try{
			in = c.getAssets().open(urlStr);
            BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(in));
            String line = null;
            StringBuilder sb = new StringBuilder();
            do {
                line = bufferedReader.readLine();
				// \s 匹配任何空白字符，包括空格、制表符、换页符等等
				// . 匹配除换行符 \n 之外的任何单字符。要匹配 . ，请使用 \.
				// '*'，'+'和'?'这三个符号，表示一个或一序列字符重复出现的次数。它们分别表示“没有或
				//      更多”，“一次或更多”还有“没有或一次”
				// 因此如下表示的应该是过滤掉注释行
                if (line != null && !line.matches("^\\s*\\/\\/.*")) {
                    sb.append(line);
                }
            } while (line != null);

            bufferedReader.close();
            in.close();
 
            return sb.toString();
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			if(in != null) {
				try {
					in.close();
				} catch (IOException e) {
				}
			}
		}
		return null;
	}
}
