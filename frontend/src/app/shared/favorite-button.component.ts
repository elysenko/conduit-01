import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-favorite-button',
  templateUrl: './favorite-button.component.html',
  styleUrl: './favorite-button.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FavoriteButtonComponent {
  @Input({ required: true }) favorited = false;
  @Input({ required: true }) count = 0;
  /** `compact` is the small pill used in feed rows; the full form is used on the article page. */
  @Input() compact = false;
  @Input() label = 'Favorite Article';
  @Output() readonly toggled = new EventEmitter<void>();
}
