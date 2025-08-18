// Configuración del juego de bingo
window.BingoConfig = {
    // Configuración de la aplicación
    app: {
        name: 'Bingo Multijugador',
        version: '1.0.0',
        author: 'Tu Nombre'
    },
    
    // Configuración del juego
    game: {
        maxPlayers: 20,
        maxTables: 20,
        numbersRange: { min: 1, max: 75 },
        autoMarkNumbers: true, // Marcar automáticamente números en la tabla
        showTimer: true,
        enableSounds: true,
        enableAnimations: true
    },
    
    // Configuración de sonidos
    sounds: {
        enabled: true,
        volume: 0.5,
        useFileSounds: false,
        basePath: '/sounds/',
        effects: {
            numberCalled: true,
            mark: true,
            bingo: true,
            error: true,
            success: true,
            notification: true
        }
    },
    
    // Configuración de la interfaz
    ui: {
        theme: 'default', // default, dark, colorful
        language: 'es',
        animations: {
            duration: 300,
            easing: 'ease-in-out'
        },
        responsive: {
            mobile: 768,
            tablet: 1024
        }
    },
    
    // Configuración de patrones de juego
    patterns: {
        linea: {
            name: 'Línea',
            description: '5 números en línea (horizontal, vertical o diagonal)',
            enabled: true,
            icon: 'fas fa-minus'
        },
        tablaLlena: {
            name: 'Tabla Llena',
            description: 'Todos los 25 números de la tabla',
            enabled: true,
            icon: 'fas fa-square'
        },
        cuatroEsquinas: {
            name: 'Cuatro Esquinas',
            description: 'Los 4 números de las esquinas',
            enabled: true,
            icon: 'fas fa-border-all'
        },
        loco: {
            name: 'Patrón Loco',
            description: 'Forma de X en la tabla',
            enabled: false,
            icon: 'fas fa-times'
        }
    },
    
    // Configuración de colores
    colors: {
        primary: '#667eea',
        secondary: '#764ba2',
        success: '#48bb78',
        warning: '#ed8936',
        error: '#f56565',
        info: '#4299e1',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        card: 'rgba(255, 255, 255, 0.95)',
        text: '#4a5568',
        textLight: '#718096'
    },
    
    // Configuración de animaciones
    animations: {
        numberCalled: {
            duration: 500,
            scale: 1.2,
            color: '#ed8936'
        },
        mark: {
            duration: 300,
            scale: 0.95,
            color: '#48bb78'
        },
        bingo: {
            duration: 1000,
            scale: 1.1,
            color: '#9f7aea'
        }
    },
    
    // Configuración de notificaciones
    notifications: {
        duration: 5000,
        position: 'top-right',
        maxVisible: 5,
        types: {
            success: { icon: 'fas fa-check-circle', color: '#48bb78' },
            error: { icon: 'fas fa-exclamation-circle', color: '#f56565' },
            warning: { icon: 'fas fa-exclamation-triangle', color: '#ed8936' },
            info: { icon: 'fas fa-info-circle', color: '#4299e1' }
        }
    },
    
    // Configuración de desarrollo
    development: {
        debug: false,
        logLevel: 'info', // error, warn, info, debug
        mockData: false,
        autoConnect: false
    }
};

// Funciones de utilidad para la configuración
window.BingoConfig.get = function(path) {
    return path.split('.').reduce((obj, key) => obj && obj[key], this);
};

window.BingoConfig.set = function(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, key) => obj[key] = obj[key] || {}, this);
    target[lastKey] = value;
};

window.BingoConfig.save = function() {
    try {
        localStorage.setItem('bingoConfig', JSON.stringify(this));
    } catch (e) {
        console.warn('Could not save configuration:', e);
    }
};

window.BingoConfig.load = function() {
    try {
        const saved = localStorage.getItem('bingoConfig');
        if (saved) {
            const parsed = JSON.parse(saved);
            Object.assign(this, parsed);
        }
    } catch (e) {
        console.warn('Could not load configuration:', e);
    }
};

// Cargar configuración al inicializar
window.BingoConfig.load();
