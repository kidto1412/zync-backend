import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const basePort = parseInt(process.env.PORT || '3001', 10);
  
  const listenWithRetry = async (port: number) => {
    try {
      await app.listen(port);
      console.log(`🚀 [UniBeam Backend] Running on http://localhost:${port}`);
      console.log(`📡 [Signaling Gateway] Socket.IO mounted at ws://localhost:${port}/signaling`);
    } catch (err: any) {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[UniBeam Backend] Port ${port} is in use, falling back to port ${port + 1}`);
        await listenWithRetry(port + 1);
      } else {
        throw err;
      }
    }
  };

  await listenWithRetry(basePort);
}

bootstrap();
