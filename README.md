# 🎲 Bingo Multijugador

Un juego de bingo multijugador en tiempo real con salas, tablas únicas y múltiples patrones de juego.

## ✨ Características

- **20 tablas únicas**: Cada sala tiene 20 tablas de bingo generadas aleatoriamente
- **Hasta 20 jugadores**: Cada sala puede albergar hasta 20 jugadores simultáneos
- **Selección única de tablas**: Una vez que un jugador selecciona una tabla, no puede ser elegida por otro
- **Canto automático**: El sistema "canta" los números automáticamente
- **Marcado interactivo**: Los jugadores pueden marcar sus números en tiempo real
- **Múltiples patrones de juego**:
  - Línea (horizontal o vertical)
  - Tabla llena
  - Cuatro esquinas
  - LOCO (5 números)
- **Configuración flexible**: El anfitrión puede configurar patrones y velocidad
- **Verificación automática**: El sistema verifica automáticamente los bingos declarados
- **Interfaz moderna**: Diseño responsive y atractivo

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
   - Haz clic en "Crear Nueva Sala"
   - Configura los patrones de juego que quieres habilitar
   - Ajusta la velocidad del canto (1-10 segundos)
   - Haz clic en "Iniciar Juego"

2. **Compartir el código**
   - Copia el código de la sala que aparece en pantalla
   - Compártelo con tus amigos

3. **Gestionar el juego**
   - Espera a que todos los jugadores se unan y seleccionen sus tablas
   - Inicia el juego cuando estés listo
   - El sistema comenzará a cantar números automáticamente

### Para los Jugadores

1. **Unirse a una sala**
   - Ingresa el código de la sala proporcionado por el anfitrión
   - Escribe tu nombre
   - Haz clic en "Unirse"

2. **Seleccionar tabla**
   - Elige una de las 20 tablas disponibles
   - Cada tabla es única y no se puede repetir

3. **Jugar**
   - Los números se cantarán automáticamente
   - Marca los números que tienes en tu tabla
   - Cuando completes un patrón, haz clic en el botón correspondiente para declarar bingo

## 🎯 Patrones de Juego

### Línea
- **Horizontal**: 5 números en una fila
- **Vertical**: 5 números en una columna

### Tabla Llena
- Todos los 25 números de la tabla

### Cuatro Esquinas
- Los 4 números de las esquinas de la tabla

### LOCO (5 números)
- Marca exactamente 5 números cualesquiera y debe incluir el último número cantado

## 🛠️ Tecnologías utilizadas

- **Backend**: Node.js, Express.js, Socket.IO
- **Frontend**: HTML5, CSS3, JavaScript vanilla
- **Comunicación en tiempo real**: Socket.IO
- **Generación de tablas**: Algoritmo personalizado para tablas únicas

## 📱 Características técnicas

- **Comunicación en tiempo real** con WebSockets
- **Interfaz responsive** que funciona en móviles y desktop
- **Sincronización automática** de estado entre jugadores
- **Verificación de patrones** en tiempo real
- **Gestión de salas** con códigos únicos
- **Sistema de notificaciones** para eventos importantes

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

### Logs del servidor

El servidor muestra logs en la consola para ayudar con el debugging:

```bash
npm run dev
```

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

---

¡Diviértete jugando bingo con amigos! 🎲✨
