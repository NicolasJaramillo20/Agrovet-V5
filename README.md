# AgroVet

Aplicación web para gestión veterinaria y comercio agropecuario. El proyecto está separado en `frontend` (React/Vite) y `backend` (API Node/Express). MongoDB conserva autenticación, el catálogo actual, mascotas, citas y pedidos; PostgreSQL ofrece las tablas relacionales administrables de clientes/productos y MySQL almacena las facturas. El catálogo de productos en MongoDB y las cuentas con rol `usuario` se reflejan automáticamente en PostgreSQL, incluyendo una sincronización inicial de registros existentes. MongoDB es la fuente de verdad para esos registros sincronizados; los productos/clientes creados directamente en PostgreSQL permanecen independientes y administrables desde el panel.

## Requisitos

- Node.js 20.19+ o 22.12+ y npm.
- MongoDB Community Server ejecutándose localmente en `27017`.
- Para completar la parte relacional del parcial: PostgreSQL local en `5432` y MySQL local en `3306`, cada uno en su propio servidor.

## Configuración e inicio

1. Inicia MongoDB. La base `agrovet` se crea automáticamente al guardar el primer usuario.
2. PostgreSQL y MySQL son conexiones opcionales para que la aplicación existente siga arrancando si esos servidores no están instalados/configurados. Para habilitarlas:
   - Inicia los servicios de PostgreSQL y MySQL.
   - Ejecuta `backend/sql/create-postgres-database.sql` conectado a la base administrativa `postgres`.
   - Alternativamente, ejecuta los scripts locales ignorados `backend/sql/local-postgres-create-user.sql` y `backend/sql/local-postgres-create-database.sql` desde pgAdmin/DBeaver conectado como administrador. Ejecuta primero el script de usuario y luego el script de base de datos, como sentencias separadas. Sus credenciales ya quedan configuradas localmente en `backend/.env`.
   - Para configuración manual, crea un usuario PostgreSQL y concede permisos en la base `agrovet`; conéctate luego a esa base y ejecuta `GRANT ALL ON SCHEMA public TO agrovet_app;`.
   - Crea la base MySQL `agrovet_mysql` desde Workbench o ejecutando `backend/sql/create-mysql-database.sql`; crea un usuario con permisos sobre esa base (por ejemplo, `CREATE USER 'agrovet_app'@'localhost' IDENTIFIED BY 'tu-clave'; GRANT ALL PRIVILEGES ON agrovet_mysql.* TO 'agrovet_app'@'localhost';`).
   - Para Neon, `neon env pull` guarda `DATABASE_URL` en el `.env.local` de la raíz; el backend la carga automáticamente y la prefiere sobre la configuración PostgreSQL local. Neon `DATABASE_URL` usa el endpoint pooled para las consultas de la aplicación; reserva `DATABASE_URL_UNPOOLED` para migraciones o herramientas que requieran una conexión directa. Al iniciar, AgroVet crea/verifica también `sitios_interes` en Neon/PostgreSQL.
   - Para usar bases locales, copia las variables PostgreSQL (`POSTGRES_*`) y MySQL (`MYSQL_*`) de `backend/.env.example` a `backend/.env` y configura usuario/contraseña. Al iniciar, AgroVet crea/verifica las tablas `clientes`, `productos`, `facturas` y `detalle_factura`.
3. En `backend/.env`, configura `JWT_SECRET` con una clave aleatoria de al menos 32 caracteres y reemplaza la contraseña de administrador de ejemplo. La aplicación crea ese administrador al iniciar si no existe.
4. Para Google Sign-In, crea un cliente OAuth de tipo aplicación web en Google Cloud, añade `http://localhost:5173` a los orígenes autorizados y coloca el mismo `GOOGLE_CLIENT_ID` en `backend/.env` y `frontend/.env` (como `VITE_GOOGLE_CLIENT_ID`).
5. Para seleccionar sitios sobre el mapa, habilita **Maps JavaScript API** en el proyecto de Google Cloud y configura una clave en `frontend/.env`:

   ```dotenv
   VITE_GOOGLE_MAPS_API_KEY=tu_clave_de_maps
   ```

   Restringe la clave por sitios web (`http://localhost:5173/*` y el dominio de producción) y permite solo Maps JavaScript API. Guarda el archivo y reinicia Vite. Esta clave se usa en el navegador; nunca coloques el secreto OAuth ni credenciales de servidor en una variable `VITE_*`. Sin una clave de Maps, puedes ingresar las coordenadas manualmente y guardar los sitios.
6. Para restablecimiento de contraseña, configura SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`) en `backend/.env`. Sin SMTP, registro e inicio de sesión siguen activos, pero la recuperación devuelve un error de configuración explícito.
7. Desde la raíz del proyecto, instala dependencias e inicia ambos servidores:

   ```powershell
   npm install
   npm run dev
   ```

   La API queda en `http://localhost:5000` y la aplicación en `http://localhost:5173`. MongoDB es requerido; PostgreSQL y MySQL informan su estado en el panel de administración y no impiden iniciar las funciones que ya existían.

También puedes iniciar solo un servidor desde la raíz:

   ```powershell
   npm run dev:backend
   npm run dev:frontend
   ```

Vite reenvía las peticiones `/api` al backend local.

Para compilar el frontend: `npm run build`. Para ejecutar el linter: `npm run lint`. En `backend`, `npm start` inicia el servidor sin Nodemon.

## Docker y Render

El `Dockerfile` construye el frontend y lo sirve desde la API en el mismo puerto. En local, Docker Compose también inicia MongoDB, PostgreSQL y MySQL:

1. Copia `backend/.env.example` a `backend/.env` y configura un `JWT_SECRET` propio de al menos 32 caracteres, además de las credenciales de administrador. No agregues secretos a la imagen.
2. Desde la raíz del proyecto, ejecuta:

   ```sh
   docker compose up --build
   ```

3. Abre `http://localhost:5000`. Si ese puerto ya está ocupado, define `APP_PORT=8080` en el entorno antes de ejecutar Compose y abre `http://localhost:8080`. Para detener los servicios, ejecuta `docker compose down`; para borrar también las bases locales, ejecuta `docker compose down -v`.

Las contraseñas de PostgreSQL y MySQL definidas directamente en Compose son solo para desarrollo local; no las uses en producción. MongoDB, PostgreSQL y MySQL deben tener almacenamiento persistente en producción.

Para desplegar en Render, crea un **Web Service** con runtime **Docker** y el directorio raíz del repositorio como contexto. Render detectará el `Dockerfile`; configura el *health check path* como `/api/health`. Render debe proporcionar `PORT` automáticamente. En **Environment**, configura las variables requeridas por `backend/.env.example`, usando servicios de base de datos externos: `MONGODB_URI` es obligatorio; `DATABASE_URL` (o `POSTGRES_URL`) y `MYSQL_URL` son necesarios si habilitas esas funciones. Configura también `JWT_SECRET` con una clave segura, `CLIENT_ORIGIN` y `FRONTEND_URL` con el dominio HTTPS de Render. No uses las direcciones ni contraseñas locales de Compose en producción.

Si habilitas Google Sign-In o Maps, pasa `VITE_GOOGLE_CLIENT_ID` y `VITE_GOOGLE_MAPS_API_KEY` como *Docker build arguments*: esos valores se incorporan al frontend durante la compilación. La clave de Maps es visible en el navegador y debe restringirse por dominio; nunca incluyas secretos de servidor en variables `VITE_*`.

## Variables de entorno

| Variable | Uso | Valor local predeterminado |
| --- | --- | --- |
| `PORT` | Puerto de Express | `5000` |
| `MONGODB_URI` | Cadena de conexión Mongoose | `mongodb://localhost:27017/agrovet` |
| `JWT_SECRET` | Firma de tokens de sesión | Configurar una clave propia |
| `CLIENT_ORIGIN` | Origen autorizado por CORS | `http://localhost:5173` |
| `ADMIN_EMAIL` | Correo para crear el administrador inicial | Configurar uno propio |
| `ADMIN_PASSWORD` | Contraseña inicial del administrador | Configurar una propia |
| `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DATABASE`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Conexión PostgreSQL | `localhost:5432/agrovet` |
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` | Conexión MySQL | `localhost:3306/agrovet_mysql` |
| `GOOGLE_CLIENT_ID` | Validar credenciales OAuth de Google en el backend | Crear en Google Cloud |
| `VITE_GOOGLE_MAPS_API_KEY` | Mostrar el mapa interactivo y capturar coordenadas al hacer clic | Crear/restringir en Google Cloud |
| `SMTP_*` | Envío de enlaces de recuperación | Configurar un servidor SMTP |
| `FRONTEND_URL` | Dominio incluido en el correo de recuperación | `http://localhost:5173` |

No se deben publicar los archivos `.env` ni credenciales. `.gitignore` los excluye. `frontend/.env.example` contiene las variables de configuración frontend para Google Sign-In y Google Maps.

## Funcionalidad

- Registro e inicio de sesión con contraseñas hash y JWT; roles `usuario` y `admin`.
- Usuarios en la colección MongoDB `usuarios`: CRUD administrativo, Google Sign-In opcional y restablecimiento de contraseña con token de un solo uso y vencimiento.
- Perfil personal, gestión de mascotas y solicitudes de citas.
- Catálogo, persistencia local del carrito y compra con validación/descuento atómico del stock por producto.
- Panel de administración con métricas, usuarios, inventario y estados de citas.
- Gestión relacional de clientes/productos en PostgreSQL y emisión/listado de facturas en MySQL.
- Sitios de interés por usuario: selección de puntos en Google Maps (o ingreso manual de coordenadas), CRUD privado y almacenamiento de geolocalización en `sitios_interes` sobre Neon/PostgreSQL.
- Vistas públicas de inicio, Nosotros, productos y contacto, con interfaz adaptable a móvil.

## API principal

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PUT /api/auth/profile`
- `POST /api/auth/google`, `POST /api/auth/password/forgot`, `POST /api/auth/password/reset`
- `GET /api/products`; administración: `POST /api/products`, `PUT /api/products/:id`, `PATCH /api/products/:id/stock`, `PATCH /api/products/:id/active`, `DELETE /api/products/:id`
- `GET|POST /api/pets`, `DELETE /api/pets/:id`
- `GET|POST /api/appointments`, administración: `PATCH /api/appointments/:id/status`
- `POST /api/orders`
- Administración: `GET /api/admin/stats`, `GET /api/admin/users`, `PATCH|DELETE /api/admin/users/:id`
- CRUD administrativo de usuarios: `POST|PUT /api/admin/users`, `GET /api/admin/users`, `DELETE /api/admin/users/:id`
- `GET /api/relational/status`, CRUD `/api/relational/customers`, CRUD `/api/relational/products`, `GET /api/relational/invoices`
- `GET|POST /api/sites`, `PUT|DELETE /api/sites/:id` (cada usuario solo consulta y modifica sus propios sitios)
- `GET /api/health`

Las rutas de administración exigen un token de administrador. Las rutas privadas exigen un JWT en la cabecera de autorización Bearer.

## Nota sobre `postgres_fdw`

`postgres_fdw` solo conecta una instancia PostgreSQL con otra instancia PostgreSQL; no puede conectarse a MySQL. Para cumplir el almacenamiento indicado (clientes/productos en PostgreSQL y facturas en MySQL), esta aplicación usa conexiones nativas independientes mediante `pg` y `mysql2`. Si el docente exige específicamente acceso MySQL a través de una tabla foránea, se requiere `mysql_fdw` (extensión distinta, de terceros) o cambiar la instancia remota a PostgreSQL; no se presenta una conexión MySQL directa como si fuera `postgres_fdw`.
