/**
 * Audio Alert Utility for Caretaker Broadcast Notifications
 *
 * Plays /notification-sound.mp3 whenever a new broadcast booking is dispatched.
 * Includes debouncing, Web Audio fallback, and browser autoplay unlocking.
 */

let broadcastAudio = null
let lastPlayTimestamp = 0
let audioUnlocked = false

/**
 * Lazily initialize and configure the audio element.
 */
function getAudioElement() {
  if (typeof window === 'undefined') return null
  if (!broadcastAudio) {
    try {
      broadcastAudio = new Audio('/notification-sound.mp3')
      broadcastAudio.preload = 'auto'
      broadcastAudio.volume = 1.0
    } catch (err) {
      console.warn('[Audio] Failed to initialize Audio element:', err)
      broadcastAudio = null
    }
  }
  return broadcastAudio
}

/**
 * Web Audio API synthesizer fallback (runs if MP3 is blocked or fails to decode).
 */
function playSynthesizedChime() {
  if (typeof window === 'undefined') return
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()

    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, startTime)

      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(0.25, startTime + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(startTime)
      osc.stop(startTime + duration)
    }

    const now = ctx.currentTime
    // Pleasant two-tone chime (587.33 Hz [D5] -> 880.00 Hz [A5])
    playTone(587.33, now, 0.25)
    playTone(880.0, now + 0.18, 0.45)

    setTimeout(() => {
      ctx.close().catch(() => {})
    }, 1200)
  } catch (err) {
    console.warn('[Audio] Synthesizer fallback error:', err)
  }
}

/**
 * Prime and unlock audio playback on first user gesture to comply with browser autoplay policies.
 */
export function initAudioUnlock() {
  if (typeof window === 'undefined' || audioUnlocked) return

  const unlock = () => {
    if (audioUnlocked) return
    audioUnlocked = true

    const audio = getAudioElement()
    if (audio) {
      // Play and immediately pause to establish user activation in browser
      audio
        .play()
        .then(() => {
          audio.pause()
          audio.currentTime = 0
        })
        .catch(() => {
          // Normal if browser still requires further gesture
        })
    }

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (AudioContextClass) {
        const tempCtx = new AudioContextClass()
        if (tempCtx.state === 'suspended') {
          tempCtx.resume().catch(() => {})
        }
        setTimeout(() => tempCtx.close().catch(() => {}), 800)
      }
    } catch (_) {}

    window.removeEventListener('click', unlock, true)
    window.removeEventListener('touchstart', unlock, true)
    window.removeEventListener('keydown', unlock, true)
  }

  window.addEventListener('click', unlock, true)
  window.addEventListener('touchstart', unlock, true)
  window.addEventListener('keydown', unlock, true)
}

// Auto-register unlock listeners upon module evaluation
if (typeof window !== 'undefined') {
  initAudioUnlock()
}

/**
 * Play the broadcast notification sound for incoming caretaker jobs.
 * Debounced by 1.5 seconds to avoid overlapping multiple simultaneous alerts.
 *
 * @param {Object} [options]
 * @param {boolean} [options.force=false] - Ignore debounce check (used for user testing)
 * @returns {Promise<boolean>} True if sound played successfully
 */
export async function playBroadcastSound({ force = false } = {}) {
  const now = Date.now()
  if (!force && now - lastPlayTimestamp < 1500) {
    return false // Debounced
  }
  lastPlayTimestamp = now

  if (typeof window !== 'undefined') {
    console.log('[Audio] 🔔 Playing automatic incoming job notification chime (/notification-sound.mp3)')
  }

  const audio = getAudioElement()

  if (audio) {
    try {
      audio.currentTime = 0
      audio.volume = 1.0
      await audio.play()
      return true
    } catch (err) {
      console.warn('[Audio] audio.play() failed, using synthesizer chime fallback:', err.message)
      playSynthesizedChime()
      return true
    }
  } else {
    playSynthesizedChime()
    return true
  }
}

/**
 * Explicit test trigger allowing caretakers to verify their sound / speakers.
 */
export async function testBroadcastSound() {
  return await playBroadcastSound({ force: true })
}

