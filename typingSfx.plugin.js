/**
 * @name Typing SFX
 * @version 1.8.2
 * @source https://github.com/itsTurdle/betterdiscordplugins
 * @description A BetterDiscord plugin that polls only editable text boxes every frame for text length changes and plays a custom MP3 sound effect using the Web Audio API. When deleting text, it uses a separate lower pitch defined in the settings.
 */

module.exports = meta => {
  let settings = {
    mp3DataUrl: null,
    mp3FileName: null,
    volume: 0.5,
    minPlaybackRate: 0.85,
    maxPlaybackRate: 1.15,
    deleteMinPlaybackRate: 0.5,
    deleteMaxPlaybackRate: 0.7,
    onlyPlayOnIncreasedLength: false
  }

  let rafId = 0
  let lastActive = null
  let lastLength = 0
  const audioContext = new (window.AudioContext || window.webkitAudioContext)()
  let audioBuffer = null

  const loadSettings = () => {
    const s = BdApi.Data.load(meta.name, "settings")
    if (s) Object.assign(settings, s)
  }

  const saveSettings = () => {
    BdApi.Data.save(meta.name, "settings", settings)
  }

  const updateAudioBuffer = () => {
    if (!settings.mp3DataUrl) {
      audioBuffer = null
      return
    }
    fetch(settings.mp3DataUrl)
      .then(res => res.arrayBuffer())
      .then(data => audioContext.decodeAudioData(data))
      .then(buffer => {
        audioBuffer = buffer
      })
      .catch(err => console.error("Error decoding audio data:", err))
  }

  const getTextLength = el => {
    if (!el) return 0
    if (typeof el.value === "string") return el.value.length
    if (el.isContentEditable && typeof el.textContent === "string")
      return el.textContent.trim().length
    if (typeof el.innerText === "string") return el.innerText.trim().length
    return 0
  }

  const isEditable = el => {
    if (!el) return false
    const tag = el.tagName
    if (tag === "INPUT" || tag === "TEXTAREA") {
      return !el.readOnly && !el.disabled
    }
    if (el.isContentEditable) {
      const ce = el.getAttribute("contenteditable")
      return ce === "true" || ce === "" || ce === null
    }
    return false
  }

  const pollActiveTextbox = () => {
    const active = document.activeElement
    if (active && isEditable(active)) {
      if (active !== lastActive) {
        lastActive = active
        lastLength = getTextLength(active)
      }
      const currentLength = getTextLength(active)
      if (currentLength !== lastLength) {
        if (audioBuffer) {
          try {
            const source = audioContext.createBufferSource()
            source.buffer = audioBuffer
            let rate
            if (currentLength < lastLength) {
              rate = settings.deleteMinPlaybackRate + Math.random() * (settings.deleteMaxPlaybackRate - settings.deleteMinPlaybackRate)
            } else {
              rate = settings.minPlaybackRate + Math.random() * (settings.maxPlaybackRate - settings.minPlaybackRate)
            }
            source.playbackRate.value = rate
            const gainNode = audioContext.createGain()
            gainNode.gain.value = settings.volume
            source.connect(gainNode)
            gainNode.connect(audioContext.destination)
            source.start(0)
          } catch (err) {
            console.error("Typing SFX Error:", err)
          }
        }
        lastLength = currentLength
      }
    } else {
      lastActive = null
      lastLength = 0
    }
    rafId = requestAnimationFrame(pollActiveTextbox)
  }

  return {
    start() {
      loadSettings()
      updateAudioBuffer()
      rafId = requestAnimationFrame(pollActiveTextbox)
    },
    stop() {
      cancelAnimationFrame(rafId)
    },
    getSettingsPanel() {
      const panel = document.createElement("div")
      panel.style.padding = "10px"
      panel.style.color = "white"

      const intro = document.createElement("div")
      intro.textContent = "Select an MP3 and customize your typing sound effect:"
      intro.style.marginBottom = "15px"
      panel.appendChild(intro)

      const fileLabel = document.createElement("div")
      fileLabel.textContent = "Sound File (MP3):"
      panel.appendChild(fileLabel)

      const fileInput = document.createElement("input")
      fileInput.type = "file"
      fileInput.accept = "audio/mp3,audio/mpeg"
      fileInput.style.marginBottom = "8px"
      panel.appendChild(fileInput)

      const fileNameDisplay = document.createElement("div")
      fileNameDisplay.textContent = settings.mp3FileName ? "Current file: " + settings.mp3FileName : "No file selected."
      fileNameDisplay.style.marginBottom = "15px"
      panel.appendChild(fileNameDisplay)

      fileInput.addEventListener("change", () => {
        const f = fileInput.files[0]
        if (f) {
          settings.mp3FileName = f.name
          fileNameDisplay.textContent = "Current file: " + f.name
          const reader = new FileReader()
          reader.onload = e => {
            settings.mp3DataUrl = e.target.result
            saveSettings()
            updateAudioBuffer()
          }
          reader.onerror = e => console.error("Error reading file", e)
          reader.readAsDataURL(f)
        }
      })

      const volumeLabel = document.createElement("label")
      volumeLabel.textContent = "Volume: " + settings.volume.toFixed(2)
      volumeLabel.style.display = "block"
      volumeLabel.style.marginTop = "10px"
      panel.appendChild(volumeLabel)

      const volumeSlider = document.createElement("input")
      volumeSlider.type = "range"
      volumeSlider.min = "0"
      volumeSlider.max = "1"
      volumeSlider.step = "0.01"
      volumeSlider.value = settings.volume
      volumeSlider.style.width = "200px"
      panel.appendChild(volumeSlider)

      volumeSlider.addEventListener("input", () => {
        settings.volume = parseFloat(volumeSlider.value)
        volumeLabel.textContent = "Volume: " + settings.volume.toFixed(2)
        saveSettings()
      })

      const minLabel = document.createElement("label")
      minLabel.textContent = "Min Playback Rate: " + settings.minPlaybackRate.toFixed(2)
      minLabel.style.display = "block"
      minLabel.style.marginTop = "10px"
      panel.appendChild(minLabel)

      const minInput = document.createElement("input")
      minInput.type = "number"
      minInput.step = "0.01"
      minInput.value = settings.minPlaybackRate
      minInput.style.width = "80px"
      panel.appendChild(minInput)

      minInput.addEventListener("change", () => {
        let val = parseFloat(minInput.value)
        if (Number.isNaN(val)) val = 0.85
        settings.minPlaybackRate = val
        minLabel.textContent = "Min Playback Rate: " + settings.minPlaybackRate.toFixed(2)
        saveSettings()
      })

      const maxLabel = document.createElement("label")
      maxLabel.textContent = "Max Playback Rate: " + settings.maxPlaybackRate.toFixed(2)
      maxLabel.style.display = "block"
      maxLabel.style.marginTop = "10px"
      panel.appendChild(maxLabel)

      const maxInput = document.createElement("input")
      maxInput.type = "number"
      maxInput.step = "0.01"
      maxInput.value = settings.maxPlaybackRate
      maxInput.style.width = "80px"
      panel.appendChild(maxInput)

      maxInput.addEventListener("change", () => {
        let val = parseFloat(maxInput.value)
        if (Number.isNaN(val)) val = 1.15
        settings.maxPlaybackRate = val
        maxLabel.textContent = "Max Playback Rate: " + settings.maxPlaybackRate.toFixed(2)
        saveSettings()
      })

      const deleteMinLabel = document.createElement("label")
      deleteMinLabel.textContent = "Min Deletion Playback Rate: " + settings.deleteMinPlaybackRate.toFixed(2)
      deleteMinLabel.style.display = "block"
      deleteMinLabel.style.marginTop = "10px"
      panel.appendChild(deleteMinLabel)

      const deleteMinInput = document.createElement("input")
      deleteMinInput.type = "number"
      deleteMinInput.step = "0.01"
      deleteMinInput.value = settings.deleteMinPlaybackRate
      deleteMinInput.style.width = "80px"
      panel.appendChild(deleteMinInput)

      deleteMinInput.addEventListener("change", () => {
        let val = parseFloat(deleteMinInput.value)
        if (Number.isNaN(val)) val = 0.5
        settings.deleteMinPlaybackRate = val
        deleteMinLabel.textContent = "Min Deletion Playback Rate: " + settings.deleteMinPlaybackRate.toFixed(2)
        saveSettings()
      })

      const deleteMaxLabel = document.createElement("label")
      deleteMaxLabel.textContent = "Max Deletion Playback Rate: " + settings.deleteMaxPlaybackRate.toFixed(2)
      deleteMaxLabel.style.display = "block"
      deleteMaxLabel.style.marginTop = "10px"
      panel.appendChild(deleteMaxLabel)

      const deleteMaxInput = document.createElement("input")
      deleteMaxInput.type = "number"
      deleteMaxInput.step = "0.01"
      deleteMaxInput.value = settings.deleteMaxPlaybackRate
      deleteMaxInput.style.width = "80px"
      panel.appendChild(deleteMaxInput)

      deleteMaxInput.addEventListener("change", () => {
        let val = parseFloat(deleteMaxInput.value)
        if (Number.isNaN(val)) val = 0.7
        settings.deleteMaxPlaybackRate = val
        deleteMaxLabel.textContent = "Max Deletion Playback Rate: " + settings.deleteMaxPlaybackRate.toFixed(2)
        saveSettings()
      })

      const toggleLabel = document.createElement("label")
      toggleLabel.style.display = "block"
      toggleLabel.style.marginTop = "10px"
      toggleLabel.textContent = "Play Sound Only On New Characters:"
      panel.appendChild(toggleLabel)

      const toggleCheckbox = document.createElement("input")
      toggleCheckbox.type = "checkbox"
      toggleCheckbox.checked = settings.onlyPlayOnIncreasedLength
      panel.appendChild(toggleCheckbox)

      toggleCheckbox.addEventListener("change", () => {
        settings.onlyPlayOnIncreasedLength = toggleCheckbox.checked
        saveSettings()
      })

      return panel
    }
  }
}
