## Dependencias 
```bash
$ npm i @nestjs/config

# mongoose
$ npm i @nestjs/mongoose mongoose

# class-validator class-transformer
$ npm install --save class-validator
$ npm install class-transformer --save

# bcrypt para hash de contraseñas
$ npm i bcrypt 

# passport para autenticacion y JWT
$ npm i @nestjs/passport passport passport-local @nestjs/jwt passport-jwt

# Generar codigo para clave
$ node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Compilar y correr

```bash
$ npm run start

$ npm run start:dev
```