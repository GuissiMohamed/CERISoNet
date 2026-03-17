// ======================================================
// Service Angular WebSocket
// Permet :
// - de se connecter au serveur Socket.io
// - d'écouter des événements temps réel
// - d'émettre des événements (like, partage)
// ======================================================
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private socket: Socket;

  constructor() {
    this.socket = io({
      withCredentials: true,
      transports: ['websocket'],
      autoConnect: false
    });
  }

  connect(): void {
    if (!this.socket.connected) {
      this.socket.connect();
    }
  }

  disconnect(): void {
    if (this.socket.connected) {
      this.socket.disconnect();
    }
  }

  listen(eventName: string): Observable<any> {
    return new Observable((subscriber) => {
      const handler = (data: any) => subscriber.next(data);
      this.socket.on(eventName, handler);

      return () => {
        this.socket.off(eventName, handler);
      };
    });
  }

  emit(eventName: string, data: any): void {
    this.socket.emit(eventName, data);
  }
}