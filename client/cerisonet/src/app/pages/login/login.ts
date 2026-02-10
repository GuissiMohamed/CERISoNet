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
  lastLogin = localStorage.getItem('lastLogin');

  constructor(
    private auth: AuthService,
    private notify: NotifyService,
    private router: Router
  ) {}

 submit() {
  this.auth.login(this.mail, this.password).subscribe({
    next: () => {
      localStorage.setItem('lastLogin', new Date().toISOString());
      this.notify.show('Connexion réussie ✅');
      this.router.navigate(['/wall']);
    },
    error: () => this.notify.show('Connexion refusée ❌')
  });
}

}
