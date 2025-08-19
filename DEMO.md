# 🎲 Demo del Bingo Multijugador

## 🚀 Cómo probar la aplicación

### 1. Iniciar el servidor
```bash
npm start
```

### 2. Abrir múltiples pestañas del navegador
Abre `http://localhost:3000` en varias pestañas para simular múltiples jugadores.

### 3. Escenario de prueba

#### Paso 1: Crear una sala (Anfitrión)
1. En la primera pestaña, haz clic en "Crear Nueva Sala"
2. Configura los patrones de juego que quieres habilitar
3. Ajusta la velocidad del canto (recomendado: 3 segundos)
4. Haz clic en "Iniciar Juego"

#### Paso 2: Unirse jugadores
1. En las otras pestañas, haz clic en "Unirse a Sala"
2. Copia el código de la sala de la primera pestaña
3. Escribe un nombre diferente para cada jugador
4. Haz clic en "Unirse"

#### Paso 3: Seleccionar tablas
1. Cada jugador debe seleccionar una tabla diferente
2. Las tablas se marcan como "ocupadas" una vez seleccionadas
3. No se pueden seleccionar tablas ya ocupadas

#### Paso 4: Jugar
1. El anfitrión inicia el juego
2. Los números se cantan automáticamente
3. Los jugadores marcan sus números
4. Cuando alguien completa un patrón, declara bingo

## 🎯 Patrones de juego disponibles

### Línea
- **Horizontal**: 5 números en una fila
- **Vertical**: 5 números en una columna  
- **Diagonal**: 5 números en diagonal

### Tabla Llena
- Todos los 25 números de la tabla

### Cuatro Esquinas
- Los 4 números de las esquinas

### LOCO (5 números)
- Marca exactamente 5 números cualesquiera

## 🔧 Características técnicas

### Comunicación en tiempo real
- WebSockets con Socket.IO
- Sincronización automática entre jugadores
- Notificaciones instantáneas

### Generación de tablas
- 20 tablas únicas por sala
- Algoritmo que garantiza que no se repitan
- Distribución correcta de números por columna

### Verificación de patrones
- Verificación automática de bingos
- Múltiples patrones soportados
- Prevención de bingos falsos

### Interfaz de usuario
- Diseño responsive
- Animaciones suaves
- Efectos de sonido
- Notificaciones visuales

## 🎮 Flujo del juego

```
1. Anfitrión crea sala
   ↓
2. Jugadores se unen
   ↓
3. Cada jugador selecciona tabla
   ↓
4. Anfitrión inicia juego
   ↓
5. Sistema canta números automáticamente
   ↓
6. Jugadores marcan números
   ↓
7. Jugadores declaran bingo
   ↓
8. Sistema verifica y anuncia ganador
```

## 🐛 Solución de problemas comunes

### El servidor no inicia
```bash
# Verificar que Node.js esté instalado
node --version

# Verificar que las dependencias estén instaladas
npm install

# Verificar que el puerto 3000 esté libre
netstat -an | findstr :3000
```

### Los jugadores no se pueden unir
- Verificar que el código de la sala sea correcto
- Asegurarse de que la sala no esté llena (máximo 20 jugadores)
- Verificar la conexión a internet

### Los números no se cantan
- Verificar que el anfitrión haya iniciado el juego
- Verificar que la velocidad del canto no sea muy alta
- Revisar la consola del navegador para errores

### No se pueden marcar números
- Verificar que hayas seleccionado una tabla
- Asegurarte de que el número haya sido cantado
- Verificar que no haya problemas de conexión

## 📱 Compatibilidad

### Navegadores soportados
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

### Dispositivos
- Desktop (recomendado)
- Tablet
- Móvil (interfaz responsive)

## 🎨 Personalización

### Cambiar colores
Edita `public/config.js`:
```javascript
colors: {
    primary: '#tu-color',
    secondary: '#tu-color',
    // ...
}
```

### Cambiar velocidad del canto
En la configuración de la sala, ajusta el slider de velocidad.

### Habilitar/deshabilitar patrones
En la configuración de la sala, marca/desmarca los patrones deseados.

### Cambiar sonidos
Edita `public/sounds.js` para personalizar los efectos de sonido.

## 🔒 Seguridad

- Las salas se identifican con códigos de 4 dígitos
- No se almacenan datos sensibles
- Las conexiones se validan en el servidor
- Prevención de bingos falsos

## 📊 Estadísticas

- Máximo 20 jugadores por sala
- 20 tablas únicas por sala
- 75 números posibles (1-75)
- 4 patrones de juego diferentes
- Tiempo real de sincronización

---

¡Disfruta jugando bingo con amigos! 🎲✨
