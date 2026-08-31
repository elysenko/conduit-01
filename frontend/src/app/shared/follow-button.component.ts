import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-follow-button',
  templateUrl: './follow-button.component.html',
  styleUrl: './follow-button.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FollowButtonComponent {
  @Input({ required: true }) username = '';
  @Input({ required: true }) following = false;
  @Output() readonly toggled = new EventEmitter<void>();
}
