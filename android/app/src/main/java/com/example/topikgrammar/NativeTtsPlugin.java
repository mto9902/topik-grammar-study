package com.example.topikgrammar;

import android.os.Build;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;
import java.util.UUID;

@CapacitorPlugin(name = "NativeTts")
public class NativeTtsPlugin extends Plugin {
  private TextToSpeech tts;
  private boolean initialized = false;
  private boolean supported = false;
  private String pendingText = null;
  private String currentText = "";

  @Override
  public void load() {
    tts = new TextToSpeech(getContext(), status -> {
      initialized = true;
      if (status == TextToSpeech.SUCCESS) {
        supported = configureLanguage();
        tts.setSpeechRate(0.96f);
        tts.setPitch(1.0f);
      } else {
        supported = false;
      }

      emitState(false, "");

      if (supported && pendingText != null && !pendingText.isEmpty()) {
        String queued = pendingText;
        pendingText = null;
        speakInternal(queued);
      } else {
        pendingText = null;
      }
    });

    tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
      @Override
      public void onStart(String utteranceId) {
        emitState(true, currentText);
      }

      @Override
      public void onDone(String utteranceId) {
        emitState(false, currentText);
      }

      @Override
      public void onError(String utteranceId) {
        emitState(false, currentText);
      }

      @Override
      public void onError(String utteranceId, int errorCode) {
        emitState(false, currentText);
      }
    });
  }

  @PluginMethod
  public void isSupported(PluginCall call) {
    JSObject result = new JSObject();
    result.put("supported", supported);
    result.put("initialized", initialized);
    call.resolve(result);
  }

  @PluginMethod
  public void speak(PluginCall call) {
    String text = call.getString("text", "").trim();
    if (text.isEmpty()) {
      call.reject("Text is required.");
      return;
    }

    if (!initialized) {
      pendingText = text;
      call.resolve();
      return;
    }

    if (!supported || tts == null) {
      call.reject("Native TTS is unavailable.");
      return;
    }

    speakInternal(text);
    call.resolve();
  }

  @PluginMethod
  public void stop(PluginCall call) {
    if (tts != null) {
      tts.stop();
    }
    currentText = "";
    pendingText = null;
    emitState(false, "");
    call.resolve();
  }

  private void speakInternal(String text) {
    if (tts == null) return;

    currentText = text;
    pendingText = null;

    String utteranceId = UUID.randomUUID().toString();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      Bundle params = new Bundle();
      tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId);
    } else {
      tts.speak(text, TextToSpeech.QUEUE_FLUSH, null);
      emitState(true, currentText);
    }
  }

  private boolean configureLanguage() {
    if (tts == null) return false;

    Locale preferredLocale = Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP
      ? Locale.forLanguageTag("ko-KR")
      : Locale.KOREAN;
    int preferredResult = tts.setLanguage(preferredLocale);
    if (preferredResult != TextToSpeech.LANG_MISSING_DATA && preferredResult != TextToSpeech.LANG_NOT_SUPPORTED) {
      return true;
    }

    int koreanResult = tts.setLanguage(Locale.KOREAN);
    if (koreanResult != TextToSpeech.LANG_MISSING_DATA && koreanResult != TextToSpeech.LANG_NOT_SUPPORTED) {
      return true;
    }

    Locale fallbackLocale = Locale.getDefault();
    int fallbackResult = tts.setLanguage(fallbackLocale);
    return fallbackResult != TextToSpeech.LANG_MISSING_DATA && fallbackResult != TextToSpeech.LANG_NOT_SUPPORTED;
  }

  private void emitState(boolean speaking, String text) {
    currentText = speaking ? text : "";
    JSObject payload = new JSObject();
    payload.put("speaking", speaking);
    payload.put("text", speaking ? text : "");
    bridge.executeOnMainThread(() -> notifyListeners("ttsStateChange", payload, true));
  }

  @Override
  protected void handleOnDestroy() {
    if (tts != null) {
      tts.stop();
      tts.shutdown();
      tts = null;
    }
    currentText = "";
    pendingText = null;
    initialized = false;
    supported = false;
  }
}
