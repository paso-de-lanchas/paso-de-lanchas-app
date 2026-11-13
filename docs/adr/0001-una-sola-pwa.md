# ADR 0001 — Una sola aplicación web progresiva (PWA) con Next.js

- **Estado:** aceptada
- **Fecha:** 2026-11-08
- **Decisores:** Omar, Pamela, Diego, José, Cova

## Contexto

La primera propuesta (planeación v1.0) tenía tres piezas: app móvil nativa (React Native + Expo), panel web de
administración y un backend separado (NestJS) con WebSockets y Redis. El equipo es de 5 estudiantes que se inician en un
proyecto real, y el sistema tiene 4 roles (pasajero, chofer, administrador y superadministrador).

## Decisión

Construir **una sola aplicación web progresiva** con **Next.js + TypeScript**, donde el frontend y la API viven en el
mismo proyecto, organizado con arquitectura limpia por carpetas (`domain`, `application`, `infrastructure`, `app`).
El tiempo real se resuelve con consultas periódicas (5–10 s) en lugar de WebSockets y Redis.

## Consecuencias

- Un solo repositorio, un solo despliegue (Vercel) y un solo lenguaje; cada historia es una rama y un pull request.
- Se instala desde el navegador, sin publicar en tiendas de apps.
- El QR dinámico funciona sin internet si la PWA está instalada.
- Limitación aceptada: el GPS del chofer solo se envía con la página abierta (se mantiene la pantalla encendida con
  Wake Lock); las notificaciones push en iPhone requieren instalar la PWA.
- Se estima 40–60 % menos esfuerzo que la opción nativa.
