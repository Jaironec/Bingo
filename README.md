# 🎲 Bingo Multijugador

Un juego de bingo multijugador en tiempo real con salas, tablas únicas, múltiples patrones de juego y sistema de desempate automático con dados.

## ✨ Características

- **20 tablas únicas**: Cada sala tiene 20 tablas de bingo generadas aleatoriamente
- **Hasta 20 jugadores**: Cada sala puede albergar hasta 20 jugadores simultáneos
- **Selección única de tablas**: Una vez que un jugador selecciona una tabla, no puede ser elegida por otro
- **Verificación de tablas**: El juego solo inicia cuando TODOS han seleccionado tabla
- **Canto automático**: El sistema "canta" los números automáticamente
- **Marcado interactivo**: Los jugadores pueden marcar sus números en tiempo real
- **Múltiples patrones de juego**:
  - Línea (horizontal o vertical)
  - Tabla llena
  - Cuatro esquinas
  - LOCO (5 números reales - FREE no cuenta)
  - Machetaso (diagonales)
- **Sistema de desempate automático**: Con dados 3D cuando hay empates
- **Panel de modos disponibles**: Muestra en tiempo real qué patrones están disponibles
- **Configuración flexible**: El anfitrión puede configurar patrones y velocidad
- **Verificación automática**: El sistema verifica automáticamente los bingos declarados
- **Interfaz moderna**: Diseño responsive, animaciones 3D y efectos visuales atractivos

## 🚀 Instalación

### Prerrequisitos

- Node.js (versión 14 o superior)
- npm o yarn

### Pasos de instalación

1. **Clonar o descargar el proyecto**
   ```bash
   git clone <url-del-repositorio>
   cd Bingo
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Iniciar el servidor**
   ```bash
   npm start
   ```

4. **Abrir en el navegador**
   ```
   http://localhost:3000
   ```

## 🎮 Cómo jugar

### Para el Anfitrión

1. **Crear una sala**
   - Haz clic en "Jugar"
   - Selecciona "Crear Sala"
   - Configura los patrones de juego que quieres habilitar
   - Ajusta la velocidad del canto (1-10 segundos)
   - Ingresa tu nombre como anfitrión
   - Haz clic en "Crear Sala"

2. **Compartir el código**
   - Copia el código de la sala que aparece en pantalla
   - Compártelo con tus amigos

3. **Gestionar el juego**
   - Espera a que todos los jugadores se unan y seleccionen sus tablas
   - **IMPORTANTE**: El botón "Iniciar Juego" solo se habilita cuando todas las tablas están seleccionadas
   - Inicia el juego cuando estés listo
   - El sistema comenzará a cantar números automáticamente

### Para los Jugadores

1. **Unirse a una sala**
   - Haz clic en "Jugar"
   - Selecciona "Unirse a Sala"
   - Ingresa el código de la sala proporcionado por el anfitrión
   - Escribe tu nombre
   - Haz clic en "Unirse"

2. **Seleccionar tabla**
   - Elige una de las 20 tablas disponibles
   - Cada tabla es única y no se puede repetir
   - **IMPORTANTE**: El juego no puede iniciar hasta que todos hayan seleccionado tabla

3. **Jugar**
   - Los números se cantarán automáticamente
   - Marca los números que tienes en tu tabla
   - **NUEVO**: Ve el panel de "Modos Disponibles" en tiempo real
   - Cuando completes un patrón, haz clic en el botón correspondiente para declarar bingo

## 🎯 Patrones de Juego

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
- Solo números marcados manualmente, no la estrella del centro

### Machetaso
- **Diagonal Principal**: 5 números en diagonal de esquina superior izquierda a inferior derecha
- **Diagonal Secundaria**: 5 números en diagonal de esquina superior derecha a inferior izquierda

## 🎲 Sistema de Desempate (NUEVO)

### Cuándo ocurre
- Cuando múltiples jugadores ganan el mismo patrón con el mismo número
- Se detecta automáticamente por el sistema

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

## 🛠️ Tecnologías utilizadas

- **Backend**: Node.js, Express.js, Socket.IO
- **Frontend**: HTML5, CSS3, JavaScript vanilla
- **Comunicación en tiempo real**: Socket.IO
- **Generación de tablas**: Algoritmo personalizado para tablas únicas
- **Animaciones**: CSS3 con transformaciones 3D y keyframes

## 📱 Características técnicas

- **Comunicación en tiempo real** con WebSockets
- **Interfaz responsive** que funciona en móviles y desktop
- **Sincronización automática** de estado entre jugadores
- **Verificación de patrones** en tiempo real
- **Gestión de salas** con códigos únicos
- **Sistema de notificaciones** inteligente anti-spam
- **Sistema de desempate** automático con dados 3D
- **Verificación de tablas** antes de iniciar el juego

## 🎨 Interfaz de usuario

La aplicación cuenta con una interfaz moderna y intuitiva:

- **Pantalla de inicio**: Crear o unirse a salas
- **Pantalla de configuración**: Configurar patrones y velocidad (solo anfitrión)
- **Pantalla de selección de tabla**: Elegir tabla de bingo
- **Pantalla de juego**: Interfaz completa del juego con:
  - Tabla de bingo personal
  - Números cantados
  - Números marcados
  - Lista de jugadores
  - Botones para declarar bingo
  - Lista de ganadores
  - **NUEVO**: Panel de modos disponibles
  - **NUEVO**: Sistema de desempate automático

## 🔧 Configuración avanzada

### Variables de entorno

Puedes configurar el puerto del servidor:

```bash
PORT=3000 npm start
```

### Personalización

Para personalizar el juego, puedes modificar:

- **Velocidad del canto**: En la configuración de la sala
- **Patrones de juego**: En el servidor (`server.js`)
- **Número de tablas**: En la función `generarTablasUnicas()`
- **Estilos**: En `public/styles.css`
- **Animaciones**: En los keyframes CSS para los dados

## 🐛 Solución de problemas

### Problemas comunes

1. **No se puede unir a la sala**
   - Verifica que el código de la sala sea correcto
   - Asegúrate de que la sala no esté llena (máximo 20 jugadores)

2. **Los números no se cantan**
   - Verifica que el anfitrión haya iniciado el juego
   - Asegúrate de que la conexión a internet sea estable

3. **No se puede marcar números**
   - Verifica que hayas seleccionado una tabla
   - Asegúrate de que el número haya sido cantado

4. **El botón "Iniciar Juego" no se habilita**
   - **NUEVO**: Verificar que TODOS los jugadores hayan seleccionado tabla
   - Esperar a que se actualice el estado (puede tomar unos segundos)
   - Verificar que no haya errores en la consola

5. **LOCO bingo no funciona**
   - **IMPORTANTE**: La estrella FREE NO cuenta para LOCO
   - Necesitas exactamente 5 números reales marcados
   - El último número cantado debe estar entre los marcados

### Logs del servidor

El servidor muestra logs en la consola para ayudar con el debugging:

```bash
npm run dev
```

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

## 🤝 Contribuir

Si quieres contribuir al proyecto:

1. Fork el repositorio
2. Crea una rama para tu feature
3. Haz commit de tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🙏 Agradecimientos

- Socket.IO por la comunicación en tiempo real
- Font Awesome por los iconos
- Google Fonts por la tipografía Poppins
- CSS3 por las animaciones y transformaciones 3D

---

¡Diviértete jugando bingo con amigos! 🎲✨
