/**
 * @name Typing SFX
 * @version 1.1.0
 * @source https://github.com/itsTurdle/betterdiscordplugins
 * @description A BetterDiscord plugin for custom MP3 typing sound effects. By default, it plays a sound whenever text length changes (including removal). Check "Play Sound Only On New Characters" in settings to disable removal sounds.
 */

module.exports = meta => {
  let settings = {
    mp3DataUrl: null,
    mp3FileName: null,
    volume: 0.5,
    minPlaybackRate: 0.85,
    maxPlaybackRate: 1.15,
    onlyPlayOnIncreasedLength: false
  }

  const loadSettings = () => {
    const s = BdApi.Data.load(meta.name, "settings")
    if (s) settings = Object.assign(settings, s)
  }

  const saveSettings = () => {
    BdApi.Data.save(meta.name, "settings", settings)
  }

  const getTextLength = e => {
    if (typeof e.value === "string") return e.value.length
    if (typeof e.innerText === "string") return e.innerText.length
    return 0
  }

  const keyHandler = e => {
    const t = e.target
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
      setTimeout(() => {
        const c = getTextLength(t)
        const p = parseInt(t.dataset.typingSfxPrevLength || "0", 10)
        let shouldPlay
        if (settings.onlyPlayOnIncreasedLength) {
          shouldPlay = c > p
        } else {
          shouldPlay = c !== p
        }
        if (shouldPlay && settings.mp3DataUrl) {
          try {
            const audio = new Audio(settings.mp3DataUrl)
            audio.playbackRate = settings.minPlaybackRate + Math.random() * (settings.maxPlaybackRate - settings.minPlaybackRate)
            audio.volume = settings.volume
            audio.play().catch(err => console.error("Typing SFX playback failed:", err))
          } catch (err) {
            console.error("Typing SFX Error:", err)
          }
        }
        t.dataset.typingSfxPrevLength = c
      }, 0)
    }
  }

  return {
    start() {
      loadSettings()
      document.addEventListener("keydown", keyHandler, true)
    },
    stop() {
      document.removeEventListener("keydown", keyHandler, true)
    },
    getSettingsPanel() {
      const p = document.createElement("div")
      p.style.padding = "10px"
      p.style.color = "white"

      const d = document.createElement("div")
      d.textContent = "Select an MP3 and customize your typing sound effect:"
      d.style.marginBottom = "15px"
      p.appendChild(d)

      const fl = document.createElement("div")
      fl.textContent = "Sound File (MP3):"
      p.appendChild(fl)

      const fi = document.createElement("input")
      fi.type = "file"
      fi.accept = "audio/mp3,audio/mpeg"
      fi.style.marginBottom = "8px"
      p.appendChild(fi)

      const fd = document.createElement("div")
      fd.textContent = settings.mp3FileName
        ? "Current file: " + settings.mp3FileName
        : "No file selected."
      fd.style.marginBottom = "15px"
      p.appendChild(fd)

      fi.addEventListener("change", () => {
        const f = fi.files[0]
        if (f) {
          settings.mp3FileName = f.name
          fd.textContent = "Current file: " + f.name
          const r = new FileReader()
          r.onload = e => {
            settings.mp3DataUrl = e.target.result
            saveSettings()
          }
          r.onerror = e => {
            console.error("Error reading file", e)
          }
          r.readAsDataURL(f)
        }
      })

      const vl = document.createElement("label")
      vl.textContent = "Volume: " + settings.volume.toFixed(2)
      vl.style.display = "block"
      vl.style.marginTop = "10px"
      p.appendChild(vl)

      const vs = document.createElement("input")
      vs.type = "range"
      vs.min = "0"
      vs.max = "1"
      vs.step = "0.01"
      vs.value = settings.volume
      vs.style.width = "200px"
      p.appendChild(vs)

      vs.addEventListener("input", () => {
        settings.volume = parseFloat(vs.value)
        vl.textContent = "Volume: " + settings.volume.toFixed(2)
        saveSettings()
      })

      const mnL = document.createElement("label")
      mnL.textContent = "Min Playback Rate: " + settings.minPlaybackRate.toFixed(2)
      mnL.style.display = "block"
      mnL.style.marginTop = "10px"
      p.appendChild(mnL)

      const mnI = document.createElement("input")
      mnI.type = "number"
      mnI.step = "0.01"
      mnI.value = settings.minPlaybackRate
      mnI.style.width = "80px"
      p.appendChild(mnI)

      mnI.addEventListener("change", () => {
        let v = parseFloat(mnI.value)
        if (Number.isNaN(v)) v = 0.85
        settings.minPlaybackRate = v
        mnL.textContent = "Min Playback Rate: " + settings.minPlaybackRate.toFixed(2)
        saveSettings()
      })

      const mxL = document.createElement("label")
      mxL.textContent = "Max Playback Rate: " + settings.maxPlaybackRate.toFixed(2)
      mxL.style.display = "block"
      mxL.style.marginTop = "10px"
      p.appendChild(mxL)

      const mxI = document.createElement("input")
      mxI.type = "number"
      mxI.step = "0.01"
      mxI.value = settings.maxPlaybackRate
      mxI.style.width = "80px"
      p.appendChild(mxI)

      mxI.addEventListener("change", () => {
        let v = parseFloat(mxI.value)
        if (Number.isNaN(v)) v = 1.15
        settings.maxPlaybackRate = v
        mxL.textContent = "Max Playback Rate: " + settings.maxPlaybackRate.toFixed(2)
        saveSettings()
      })

      const pl = document.createElement("label")
      pl.style.display = "block"
      pl.style.marginTop = "10px"
      pl.textContent = "Play Sound Only On New Characters:"
      p.appendChild(pl)

      const pc = document.createElement("input")
      pc.type = "checkbox"
      pc.checked = settings.onlyPlayOnIncreasedLength
      p.appendChild(pc)

      pc.addEventListener("change", () => {
        settings.onlyPlayOnIncreasedLength = pc.checked
        saveSettings()
      })

      return p
    }
  }
}
