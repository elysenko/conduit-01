import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Driven by `?modal=confirm-delete` so the confirmation state is deep-linkable and a
 * reviewer can open it directly instead of having to reproduce a click sequence.
 */
@Component({
  selector: 'app-confirm-modal',
  templateUrl: './confirm-modal.component.html',
  styleUrl: './confirm-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmModalComponent {
  @Input() heading = 'Are you sure?';
  @Input() message = 'This action cannot be undone.';
  @Input() confirmLabel = 'Delete';
  @Output() readonly confirmed = new EventEmitter<void>();
  @Output() readonly dismissed = new EventEmitter<void>();
}
