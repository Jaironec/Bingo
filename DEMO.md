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
1. En la primera pestaña, haz clic en "Jugar"
2. Selecciona "Crear Sala"
3. Configura los patrones de juego que quieres habilitar
4. Ajusta la velocidad del canto (recomendado: 3 segundos)
5. Ingresa tu nombre como anfitrión
6. Haz clic en "Crear Sala"

#### Paso 2: Unirse jugadores
1. En las otras pestañas, haz clic en "Jugar"
2. Selecciona "Unirse a Sala"
3. Copia el código de la sala de la primera pestaña
4. Escribe un nombre diferente para cada jugador
5. Haz clic en "Unirse"

#### Paso 3: Seleccionar tablas
1. Cada jugador debe seleccionar una tabla diferente
2. Las tablas se marcan como "ocupadas" una vez seleccionadas
3. No se pueden seleccionar tablas ya ocupadas
4. **IMPORTANTE**: El botón "Iniciar Juego" solo se habilita cuando TODOS han seleccionado tabla

#### Paso 4: Jugar
1. El anfitrión inicia el juego (botón ahora habilitado)
2. Los números se cantan automáticamente
3. Los jugadores marcan sus números
4. Cuando alguien completa un patrón, declara bingo
5. **NUEVO**: Se muestra un panel de "Modos Disponibles" en tiempo real

## 🎯 Patrones de juego disponibles

### Línea
- **Horizontal**: 5 números en una fila
- **Vertical**: 5 números en una columna  

### Tabla Llena
- Todos los 25 números de la tabla (incluye la estrella FREE)

### Cuatro Esquinas
- Los 4 números de las esquinas de la tabla

### LOCO (5 números)
- **IMPORTANTE**: Marca exactamente 5 números reales (la estrella FREE NO cuenta)
- Debe incluir el último número cantado

### Machetaso
- **Diagonal Principal**: 5 números en diagonal de esquina superior izquierda a inferior derecha
- **Diagonal Secundaria**: 5 números en diagonal de esquina superior derecha a inferior izquierda

## 🎲 Sistema de Desempate (NUEVO)

### Cuándo ocurre
- Cuando múltiples jugadores ganan el mismo patrón con el mismo número
- Se detecta automáticamente

### Flujo del desempate
1. **Modal de Victoria** → Se muestra durante 5 segundos
2. **Modal de Desempate** → Se abre automáticamente
3. **Animación de Dados** → Cada jugador "tira" 2 dados secuencialmente
4. **Resultados** → Se muestran los puntos de cada jugador
5. **Ganador** → El que tenga la suma más alta gana
6. **Cierre automático** → Después de 5 segundos

### Características especiales
- **Animación 3D completa** de los dados girando
- **Puntos visibles** para cada jugador
- **Secuencia secuencial** (un jugador a la vez)
- **Re-roll automático** si hay empate en los dados
- **Cierre automático** del modal

## 🏆 Flujo de Tabla Llena (NUEVO)

### Sin empate
1. Modal de Victoria (5 segundos)
2. Modal de Ganadores Finales (se cierra manualmente)

### Con empate
1. Modal de Victoria (5 segundos)
2. Modal de Desempate (5 segundos)
3. Modal de Ganadores Finales (se cierra manualmente)

### Características
- **NO se redirige al inicio** automáticamente
- **Solo se cierra** con botón "Entendido"
- **Muestra todos los ganadores** de la partida

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
- **NUEVO**: Validación especial para LOCO (FREE no cuenta)

### Interfaz de usuario
- Diseño responsive y moderno
- Animaciones suaves y 3D
- Efectos de sonido
- Notificaciones visuales inteligentes
- **NUEVO**: Panel de modos disponibles compacto

## 🎮 Flujo del juego actualizado

```
1. Anfitrión crea sala
   ↓
2. Jugadores se unen
   ↓
3. Cada jugador selecciona tabla
   ↓
4. Sistema verifica que todas las tablas estén seleccionadas
   ↓
5. Anfitrión inicia juego (botón habilitado)
   ↓
6. Sistema canta números automáticamente
   ↓
7. Panel de modos disponibles se actualiza en tiempo real
   ↓
8. Jugadores marcan números
   ↓
9. Jugadores declaran bingo
   ↓
10. Sistema verifica y anuncia ganador
   ↓
11. Si hay empate → Desempate automático con dados
   ↓
12. Si es tabla llena → Modal de ganadores finales
```

## 🎨 Nuevas características de la interfaz

### Panel de Modos Disponibles
- **Ubicación**: Lado derecho de la pantalla de juego
- **Contenido**: Lista de todos los patrones con su estado
- **Estados**: Disponible, Ganado, Bloqueado
- **Contador**: Progreso visual de patrones disponibles
- **Diseño**: Compacto y discreto

### Modal de Desempate
- **Diseño**: Moderno con iconos de dados
- **Animación**: Dados girando en 3D
- **Información**: Detalles del empate y jugadores
- **Resultados**: Tarjetas con puntos de cada jugador
- **Cierre**: Automático después de 5 segundos

### Modal de Ganadores Finales
- **Contenido**: Lista de todos los ganadores por patrón
- **Diseño**: Tarjetas con iconos y nombres
- **Cierre**: Solo manual (botón "Entendido")
- **No redirige**: Al inicio automáticamente

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

### El botón "Iniciar Juego" no se habilita
- **NUEVO**: Verificar que TODOS los jugadores hayan seleccionado tabla
- Esperar a que se actualice el estado (puede tomar unos segundos)
- Verificar que no haya errores en la consola

### LOCO bingo no funciona
- **IMPORTANTE**: La estrella FREE NO cuenta para LOCO
- Necesitas exactamente 5 números reales marcados
- El último número cantado debe estar entre los marcados

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
Edita `public/styles.css`:
```css
:root {
    --color-primary: #tu-color;
    --color-secondary: #tu-color;
    /* ... */
}
```

### Cambiar velocidad del canto
En la configuración de la sala, ajusta el slider de velocidad.

### Habilitar/deshabilitar patrones
En la configuración de la sala, marca/desmarca los patrones deseados.

### Cambiar sonidos
Edita `public/sounds.js` para personalizar los efectos de sonido.

## 🔒 Seguridad

- Las salas se identifican con códigos únicos
- No se almacenan datos sensibles
- Las conexiones se validan en el servidor
- Prevención de bingos falsos
- **NUEVO**: Verificación de empates en el servidor

## 📊 Estadísticas

- Máximo 20 jugadores por sala
- 20 tablas únicas por sala
- 75 números posibles (1-75)
- 5 patrones de juego diferentes
- Tiempo real de sincronización
- **NUEVO**: Sistema de desempate automático
- **NUEVO**: Panel de modos disponibles en tiempo real

## 🎯 Funcionalidades destacadas

### Sistema de Desempate
- **Automático**: Se activa cuando se detecta empate
- **Visual**: Animación 3D de dados girando
- **Justo**: Cada jugador tira dados secuencialmente
- **Eficiente**: Cierre automático después de mostrar resultados

### Verificación Inteligente
- **Tablas**: Todos deben seleccionar antes de iniciar
- **LOCO**: La estrella FREE no cuenta para este patrón
- **Empates**: Detección automática de múltiples ganadores
- **Validación**: Verificación en tiempo real de patrones

### Interfaz Mejorada
- **Modos disponibles**: Panel compacto y discreto
- **Notificaciones**: Sistema anti-spam inteligente
- **Animaciones**: Efectos visuales modernos y atractivos
- **Responsive**: Funciona perfectamente en todos los dispositivos

---

¡Disfruta jugando bingo con amigos! 🎲✨
