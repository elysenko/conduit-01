import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SystemSettingView } from '../../core/models';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-admin-settings',
  imports: [FormsModule, RouterLink],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettingsComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);

  readonly currentUser = this.auth.currentUser;
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly savedService = signal<string | null>(null);

  readonly settings = signal<SystemSettingView[]>([]);

  /**
   * Keys the admin actually typed into, by service.
   *
   * Secret values come back masked ("••••••••"), so echoing the whole form back on save
   * would overwrite a real credential with its own mask. Only edited keys are sent.
   */
  private readonly dirty = new Map<string, Set<string>>();

  readonly unconfigured = computed(() =>
    this.settings()
      .filter((item) => !item.configured)
      .map((item) => item.label),
  );

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.settings.set(await this.api.listSettings());
      this.dirty.clear();
    } catch (err) {
      this.settings.set([]);
      this.error.set(apiErrorMessage(err, 'Could not load service settings.'));
    } finally {
      this.loading.set(false);
    }
  }

  updateField(service: string, key: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const keys = this.dirty.get(service) ?? new Set<string>();
    keys.add(key);
    this.dirty.set(service, keys);

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

  async save(service: string): Promise<void> {
    const target = this.settings().find((item) => item.service === service);
    const edited = this.dirty.get(service);
    if (!target) {
      return;
    }
    this.error.set(null);
    this.savedService.set(null);

    const patch: Record<string, string> = {};
    for (const field of target.fields) {
      if (edited?.has(field.key)) {
        patch[field.key] = field.value;
      }
    }
    if (Object.keys(patch).length === 0) {
      // Nothing changed — still acknowledge, so the button never feels dead.
      this.savedService.set(service);
      return;
    }

    try {
      // The PATCH response is the freshly re-resolved view (values re-masked, and
      // `configured` recomputed server-side), so it replaces local state wholesale.
      this.settings.set(await this.api.saveSettings(patch));
      this.dirty.delete(service);
      this.savedService.set(service);
    } catch (err) {
      this.error.set(apiErrorMessage(err, 'Could not save those credentials.'));
    }
  }

  trackField(_index: number, key: string): string {
    return key;
  }
}
