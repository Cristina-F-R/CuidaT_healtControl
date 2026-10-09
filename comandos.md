source ~/.nvm/nvm.sh
cd /mnt/c/Code/tests
npm run dev:client

Luego abre http://localhost:5173 en el navegador de Windows. Si no carga, prueba http://127.0.0.1:5173.

Para ver la versión compilada en lugar del modo desarrollo:

npm run build -w client
npm run preview -w client

Esto sirve la app en http://localhost:4173.

Para comprobar que todo sigue en verde:

npm run typecheck
npm run lint
npm run test:unit