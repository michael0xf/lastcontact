(() => {
  "use strict";

  const slider = document.createElement("input");
  slider.className = "audio-volume";
  slider.type = "range";
  slider.min = "0";
  slider.max = "100";
  slider.step = "1";
  slider.value = "0";
  slider.setAttribute("data-audio-volume", "");
  slider.setAttribute("aria-label", "Громкость музыки и дождя");
  slider.setAttribute("aria-describedby", "audio-status");

  const status = document.createElement("span");
  status.className = "audio-status";
  status.id = "audio-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  let toolbar = document.querySelector("[data-find-form]");
  if (!toolbar) {
    toolbar = document.createElement("div");
    toolbar.className = "audio-toolbar";
    document.body.prepend(toolbar);
  }
  toolbar.prepend(slider, status);

  const audio = document.createElement("audio");
  audio.preload = "none";
  audio.setAttribute("playsinline", "");
  audio.setAttribute("data-background-audio", "");
  document.body.append(audio);

  let context;
  let gain;
  let source;
  let playbackRequest = 0;
  let pageReady = false;

  const siteDirectory = new URL(".", window.location.href).pathname;
  const updateLinkVolume = (link) => {
    if (!link || link.hasAttribute("download")) return;
    const href = link.getAttribute("href");
    if (!href) return;
    let url;
    try {
      url = new URL(href, document.baseURI);
    } catch (error) {
      return;
    }
    if (url.protocol !== window.location.protocol || url.origin !== window.location.origin) return;
    if (!url.pathname.startsWith(siteDirectory)) return;
    if (!url.pathname.endsWith("/") && !/\.html?$/i.test(url.pathname)) return;
    url.searchParams.set("volume", slider.value);
    if (link.href !== url.href) link.href = url.href;
  };

  const writeVolumeToUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("volume", slider.value);
    history.replaceState(history.state, "", url.href);
    document.querySelectorAll("a[href]").forEach(updateLinkVolume);
  };

  const reportError = () => {
    audio.pause();
    audio.loop = false;
    slider.value = "0";
    slider.setAttribute("aria-valuetext", "0%");
    writeVolumeToUrl();
    slider.title = "Не удалось включить звук. Попробуйте передвинуть бегунок ещё раз.";
    status.textContent = slider.title;
  };

  const updateVolume = () => {
    const request = ++playbackRequest;
    const level = Number(slider.value) / 100;
    slider.setAttribute("aria-valuetext", `${slider.value}%`);
    slider.title = `Музыка и дождь: ${slider.value}%${level === 0 ? " (выключено)" : ""}`;
    status.textContent = "";
    writeVolumeToUrl();
    audio.loop = level > 0;

    if (level === 0) {
      if (gain) gain.gain.setTargetAtTime(0, context.currentTime, 0.02);
      audio.pause();
      if (audio.readyState > 0) audio.currentTime = 0;
      return;
    }

    if (!pageReady) return;

    try {
      if (!context) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) throw new Error("Web Audio unavailable");
        context = new AudioContextClass();
        gain = context.createGain();
        gain.gain.value = 0;
        source = context.createMediaElementSource(audio);
        source.connect(gain);
        gain.connect(context.destination);
      }
      gain.gain.setTargetAtTime(level, context.currentTime, 0.02);
      if (!audio.hasAttribute("src")) {
        audio.src = "ten_drop_piano_original_rain_120s_160kbps.mp3";
      }
      const resume = context.resume();
      const play = audio.play();
      Promise.all([resume, play]).catch((error) => {
        if (request !== playbackRequest || error.name === "AbortError") return;
        if (error.name === "NotAllowedError") {
          status.textContent = "Нажмите на страницу, чтобы включить звук.";
          return;
        }
        if (Number(slider.value) > 0) reportError();
      });
    } catch (error) {
      reportError();
    }
  };

  const readVolumeFromUrl = () => {
    const value = Number(new URL(window.location.href).searchParams.get("volume"));
    slider.value = String(Number.isFinite(value) ? Math.round(Math.max(0, Math.min(100, value))) : 0);
    updateVolume();
  };

  slider.addEventListener("input", updateVolume);
  const startAfterGesture = () => {
    if (Number(slider.value) > 0 && (audio.paused || context?.state !== "running")) {
      updateVolume();
    }
  };
  document.addEventListener("click", startAfterGesture);
  document.addEventListener("keydown", startAfterGesture);
  const prepareLink = (event) => {
    updateLinkVolume(event.target.closest?.("a[href]"));
  };
  for (const type of ["pointerdown", "click", "auxclick", "contextmenu", "focusin", "keydown"]) {
    document.addEventListener(type, prepareLink, true);
  }
  window.addEventListener("popstate", readVolumeFromUrl);
  readVolumeFromUrl();

  const afterPageLoad = () => {
    const afterPaint = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          pageReady = true;
          audio.preload = "auto";
          audio.src = "ten_drop_piano_original_rain_120s_160kbps.mp3";
          audio.load();
          if (Number(slider.value) > 0) updateVolume();
        });
      });
    };
    const root = document.querySelector("[data-pages-root]");
    if (root?.querySelector(".loading")) {
      const observer = new MutationObserver(() => {
        if (root.querySelector(".loading")) return;
        observer.disconnect();
        afterPaint();
      });
      observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    } else {
      afterPaint();
    }
  };

  if (document.readyState === "complete") {
    afterPageLoad();
  } else {
    window.addEventListener("load", afterPageLoad, { once: true });
  }
})();
