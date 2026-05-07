# Live Sign Wall — NLC Neyveli Book Fair Edition

### Product Requirement Document (PRD)

### Version 2.1 — Pure Local Network Architecture

---

# Project Overview

Build a fully local-network-based interactive digital signature wall for the NLC Neyveli Book Fair.

Visitors:

* Type or draw their signature
* Submit it locally
* Instantly see it appear on a giant animated display screen

The system must work:

* Without internet
* Without cloud dependency
* Without Firebase/Supabase

Entire system should run inside a local Wi‑Fi network using a lightweight local server.

---

# Core Product Vision

Transform the traditional physical signature board into:

* A live digital participation wall
* A public interactive installation
* A crowd engagement experience

The installation should:

* Attract people visually
* Encourage participation
* Create emotional attachment to the event

---

# Important Technical Constraint

## NO CLOUD

Do NOT use:

* Supabase
* Firebase
* AWS
* Internet APIs
* External DB dependencies

System must run:

* Entirely offline
* On local LAN/Wi‑Fi

---

# Final Architecture Decision

# Architecture Type

Local network realtime architecture.

## Components

### 1. Input Client

Runs on:

* Laptop
* Tablet
* Mobile browser

Purpose:

* Capture names/signatures

---

### 2. Local Backend Server

Runs on:

* Single laptop/mini‑PC

Purpose:

* Handle realtime communication
* Store active signatures in memory
* Broadcast updates

Recommended:

* FastAPI + WebSockets

---

### 3. Display Client

Runs on:

* TV-connected laptop
* LED wall PC
* Projector system

Purpose:

* Render animated signature wall

---

# Why This Architecture

This is the correct approach because:

## Advantages

* Extremely fast
* Zero internet dependency
* Stable inside exhibition environment
* Low latency
* Cheap deployment
* Easy maintenance

## Perfect For

* Book fairs
* Exhibitions
* Conferences
* Local installations

---

# Recommended Tech Stack

# Backend

## FastAPI

Use for:

* WebSocket server
* API endpoints
* Local realtime broadcasting

## Uvicorn

ASGI server.

---

# Frontend

## React + Vite + TypeScript

Reason:

* Fast development
* Lightweight
* Easy deployment

---

# Animation Engine

## MVP

Framer Motion

## Production Scale

PixiJS

Reason:

* GPU rendering
* Handles 1000+ moving objects smoothly

---

# Communication System

# Realtime Protocol

Use:

* WebSockets

NOT polling.

Reason:

* Instant updates
* Lower network load
* Smooth realtime behavior

---

# Network Setup

# Deployment Topology

```plaintext
               [ Local Wi‑Fi Router ]
                        |
     -----------------------------------------
     |                  |                   |
[ Input Device ]   [ FastAPI Server ]   [ Display Screen ]
```

---

# Local Access

Example:

## Backend Server

```plaintext
http://192.168.1.10:8000
```

## Input Device

```plaintext
http://192.168.1.10:8000/input
```

## Display Screen

```plaintext
http://192.168.1.10:8000/display
```

---

# Functional Requirements

# 1. Input Interface

## Features

* Name typing
* Signature drawing
* Tamil support
* Touch support
* Submit button

## Requirements

* Simple UI
* Large buttons
* Non‑technical-user friendly

---

# 2. Realtime Broadcasting

When user submits:

1. Backend receives data
2. Server broadcasts via WebSocket
3. Display updates instantly

Target latency:
< 200ms local network

---

# 3. Display Wall

# Animation Behavior

Each signature should:

* Float slowly
* Drift naturally
* Bounce softly
* Rotate slightly
* Glow subtly

New signatures:

* Enter dramatically
* Larger initially
* Glow pulse

Older signatures:

* Fade into background
* Reduce opacity
* Shrink slightly

---

# 4. Rendering Strategy

# IMPORTANT

DO NOT render:

* Thousands of DOM nodes

Use:

* Canvas rendering

Future upgrade:

* PixiJS WebGL renderer

---

# 5. Signature Storage

# MVP Storage

Use:

* In-memory Python storage

Reason:

* Faster
* Simpler
* Enough for event

---

# Optional Persistence

If required:
Use local SQLite.

NOT cloud DB.

---

# Suggested Backend Structure

```plaintext
/backend
  main.py
  websocket.py
  models.py
  storage.py
```

---

# Suggested Frontend Structure

```plaintext
/frontend
  /src
    /components
      InputForm
      SignatureCanvas
      DisplayWall
      FloatingSignature

    /pages
      input.tsx
      display.tsx

    /hooks
      useWebSocket.ts

    /utils
      animation.ts
```

---

# FastAPI Backend Requirements

# Required Endpoints

## POST /submit

Submit signature data.

## GET /signatures

Fetch active signatures.

## WebSocket /ws

Realtime broadcast channel.

---

# Example Payload

```json
{
  "id": "uuid",
  "name": "Rishi",
  "signature": "base64image",
  "timestamp": 1740000000
}
```

---

# WebSocket Flow

```plaintext
User submits
      ↓
FastAPI receives
      ↓
Store in memory
      ↓
Broadcast via WebSocket
      ↓
Display client animates instantly
```

---

# Tamil Language Support

Must support:

* Tamil Unicode
* Tamil keyboard input
* Tamil font rendering

Recommended fonts:

* Noto Sans Tamil
* Latha

---

# Visual Design Direction

# Theme

Premium cinematic dark mode.

## Colors

* Black
* Deep navy
* Gold
* White glow
* Cyan accents

## Effects

* Glow
* Blur
* Depth layering
* Floating motion

---

# Performance Requirements

| Metric              | Target |
| ------------------- | ------ |
| Latency             | <200ms |
| FPS                 | 60     |
| Active objects      | 1000+  |
| Internet dependency | Zero   |
| Crash tolerance     | High   |

---

# Moderation Requirements

Need:

* Duplicate prevention
* Spam protection
* Profanity filtering

---

# Deployment Plan

# Hardware

## Server

* One laptop

## Display

* TV/projector/LED wall

## Input

* Laptop/tablet/mobile

## Network

* Local router/hotspot

---

# Recommended Deployment Method

# Option A — Router

Use dedicated Wi‑Fi router.

Best option.

---

# Option B — Laptop Hotspot

Temporary testing setup.

---

# MVP Deliverables

Claude should generate:

## Backend

* FastAPI server
* WebSocket broadcasting
* Local storage

## Frontend

* Input page
* Display page
* Realtime updates

## Animation System

* Floating signatures
* Smooth motion
* Entry effects

---

# Critical Engineering Instructions For Claude

# DO

* Use WebSockets
* Use local network only
* Optimize rendering
* Keep architecture lightweight

# DO NOT

* Use Firebase/Supabase
* Use cloud infra
* Depend on internet
* Overengineer backend

---

# Final Experience Goal

At the Neyveli Book Fair:

* People sign digitally
* Their names appear instantly
* Crowds gather near screen
* Visitors take selfies/videos
* Installation becomes a visual attraction point

The experience should feel:

* Magical
* Interactive
* Modern
* Proudly local-first
