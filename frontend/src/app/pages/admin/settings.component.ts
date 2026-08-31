import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SystemSettingView } from '../../core/models';
import { AuthService } from '../../core/auth.service';

const PLACEHOLDER = 'PLACEHOLDER_CONFIGURE_IN_SETTINGS';

@Component({
  selector: 'app-admin-settings',
  imports: [FormsModule, RouterLink],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettingsComponent {
  private readonly auth = inject(AuthService);

  readonly currentUser = this.auth.currentUser;
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly savedService = signal<string | null>(null);

  settings = signal<SystemSettingView[]>([
    {
      service: 'postgresql',
      label: 'PostgreSQL',
      description: 'Primary datastore for users, articles, comments, tags and follows.',
      configured: true,
      fields: [
        { key: 'DATABASE_URL', label: 'Connection string', value: 'postgresql://conduit:••••••••@postgres:5432/conduit', secret: true, placeholder: 'postgresql://user:password@host:5432/db' },
      ],
    },
    {
      service: 'minio',
      label: 'MinIO object storage',
      description: 'Holds uploaded avatars and article cover images. Reads fall back to plain URLs until configured.',
      configured: false,
      fields: [
        { key: 'MINIO_ENDPOINT', label: 'Endpoint', value: '', secret: false, placeholder: 'https://minio.internal:9000' },
        { key: 'MINIO_ACCESS_KEY', label: 'Access key', value: '', secret: true, placeholder: PLACEHOLDER },
        { key: 'MINIO_SECRET_KEY', label: 'Secret key', value: '', secret: true, placeholder: PLACEHOLDER },
        { key: 'MINIO_BUCKET', label: 'Bucket', value: 'conduit-media', secret: false, placeholder: 'conduit-media' },
      ],
    },
  ]);

  readonly unconfigured = computed(() =>
    this.settings()
      .filter((item) => !item.configured)
      .map((item) => item.label),
  );

  updateField(service: string, key: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.settings.update((list) =>
      list.map((item) =>
        item.service === service
          ? {
              ...item,
              fields: item.fields.map((field) =>
                field.key === key ? { ...field, value } : field,
              ),
            }
          : item,
      ),
    );
  }

  save(service: string): void {
    this.settings.update((list) =>
      list.map((item) =>
        item.service === service
          ? {
              ...item,
              configured: item.fields.every(
                (field) => field.value.trim() !== '' && field.value.trim() !== PLACEHOLDER,
              ),
            }
          : item,
      ),
    );
    this.savedService.set(service);
  }

  trackField(_index: number, key: string): string {
    return key;
  }
}
