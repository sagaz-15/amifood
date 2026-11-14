import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email('Debe indicar un correo electronico valido.').max(255),
  password: z.string().min(1, 'La contrasena es obligatoria.').max(200),
});
