// Sistema de sonidos para el juego de bingo
class SoundManager {
    constructor() {
        this.sounds = {};
        this.enabled = true;
        this.volume = 0.5;
        this.init();
    }

    init() {
        // Crear sonidos usando Web Audio API
        this.createSounds();
        
        // Intentar cargar sonidos desde archivos (si existen y está habilitado)
        try {
            const cfg = (window && window.BingoConfig && window.BingoConfig.sounds) ? window.BingoConfig.sounds : {};
            if (cfg.useFileSounds) {
                this.loadSoundFiles();
            }
        } catch (_) {
            // Ignorar si no hay configuración
        }
    }

    createSounds() {
        // Sonido de número cantado
        this.sounds.numberCalled = this.createBeepSound(800, 0.3);
        
        // Sonido de bingo
        this.sounds.bingo = this.createBingoSound();
        
        // Sonido de marcado
        this.sounds.mark = this.createBeepSound(400, 0.2);
        
        // Sonido de error
        this.sounds.error = this.createBeepSound(200, 0.4);
        
        // Sonido de éxito
        this.sounds.success = this.createBeepSound(600, 0.3);
        
        // Sonido de notificación
        this.sounds.notification = this.createBeepSound(500, 0.2);
    }

    createBeepSound(frequency, duration) {
        return () => {
            if (!this.enabled) return;
            
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(this.volume, audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration);
        };
    }

    createBingoSound() {
        return () => {
            if (!this.enabled) return;
            
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Secuencia de notas para "BINGO"
            const notes = [
                { freq: 523, duration: 0.2 }, // C
                { freq: 659, duration: 0.2 }, // E
                { freq: 784, duration: 0.2 }, // G
                { freq: 1047, duration: 0.4 }, // C (octava alta)
                { freq: 784, duration: 0.2 }  // G
            ];
            
            let currentTime = audioContext.currentTime;
            
            notes.forEach(note => {
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                
                osc.connect(gain);
                gain.connect(audioContext.destination);
                
                osc.frequency.value = note.freq;
                osc.type = 'sine';
                
                gain.gain.setValueAtTime(0, currentTime);
                gain.gain.linearRampToValueAtTime(this.volume * 0.3, currentTime + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, currentTime + note.duration);
                
                osc.start(currentTime);
                osc.stop(currentTime + note.duration);
                
                currentTime += note.duration;
            });
        };
    }

    loadSoundFiles() {
        // Base configurable
        const cfg = (window && window.BingoConfig && window.BingoConfig.sounds) ? window.BingoConfig.sounds : {};
        const base = (cfg.basePath || '/sounds/').replace(/\/+$/, '/')
        
        // Intentar cargar archivos de sonido si existen
        const soundFiles = {
            'numberCalled': base + 'number.mp3',
            'bingo': base + 'bingo.mp3',
            'mark': base + 'mark.mp3',
            'error': base + 'error.mp3',
            'success': base + 'success.mp3',
            'notification': base + 'notification.mp3'
        };

        Object.entries(soundFiles).forEach(([key, path]) => {
            this.loadSoundFile(key, path);
        });
    }

    loadSoundFile(key, path) {
        const audio = new Audio();
        audio.preload = 'auto';
        
        audio.addEventListener('canplaythrough', () => {
            this.sounds[key] = () => {
                if (!this.enabled) return;
                audio.currentTime = 0;
                audio.volume = this.volume;
                audio.play().catch(e => console.log('Error playing sound:', e));
            };
        });
        
        audio.addEventListener('error', () => {
            console.log(`Could not load sound file: ${path}`);
        });
        
        audio.src = path;
    }

    play(soundName) {
        if (this.sounds[soundName]) {
            this.sounds[soundName]();
        }
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
    }
}

// Crear instancia global
window.soundManager = new SoundManager();

// Funciones de conveniencia
function playNumberCalled() {
    window.soundManager.play('numberCalled');
}

function playBingo() {
    window.soundManager.play('bingo');
}

function playMark() {
    window.soundManager.play('mark');
}

function playError() {
    window.soundManager.play('error');
}

function playSuccess() {
    window.soundManager.play('success');
}

function playNotification() {
    window.soundManager.play('notification');
}
