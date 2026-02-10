import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private http: HttpClient) {}

  login(mail: string, password: string) {
    return this.http.post(
      '/api/login',
      { mail, password },
      { withCredentials: true }
    );
  }

  me() {
    return this.http.get('/api/me', { withCredentials: true });
  }

  logout() {
    return this.http.post('/api/logout', {}, { withCredentials: true });
  }
}
