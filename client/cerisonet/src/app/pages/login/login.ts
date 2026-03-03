import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { NotifyService } from '../../services/notify';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  mail = '';
  password = '';
  lastLogin: string | null = null;

  constructor(
    private auth: AuthService,
    private notify: NotifyService,
    private router: Router
  ) {
    const saved = localStorage.getItem('lastLogin');
    if (saved) {
      this.lastLogin = new Date(saved).toLocaleString();
    }
  }

  submit() {
    this.auth.login(this.mail, this.password).subscribe({
      next: () => {
        const now = new Date();
        localStorage.setItem('lastLogin', now.toISOString());
        this.lastLogin = now.toLocaleString();

        this.notify.show('success', 'Connexion réussie ✅');
        this.router.navigate(['/wall']);
      },
      error: (err) => {
  const msg =
    err?.error?.message ||
    'Connexion refusée ❌ Identifiants invalides';

  this.notify.show('error', msg);
}
    });
  }
}