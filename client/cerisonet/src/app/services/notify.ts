import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Notification {
  type: 'success' | 'error' | 'info';
  message: string;
}

@Injectable({ providedIn: 'root' })
export class NotifyService {
  private msg$ = new BehaviorSubject<Notification | null>(null);
  message$ = this.msg$.asObservable();

  show(type: 'success' | 'error' | 'info', message: string) {
    this.msg$.next({ type, message });
    setTimeout(() => this.msg$.next(null), 4000);
  }
}