import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginationComponent {
  @Input({ required: true }) total = 0;
  @Input() pageSize = 10;
  @Input({ required: true }) currentPage = 1;
  /** Emits a 1-based page number; the parent writes it back to `?page=`. */
  @Output() readonly pageChange = new EventEmitter<number>();

  get pages(): number[] {
    const count = Math.max(1, Math.ceil(this.total / this.pageSize));
    return Array.from({ length: count }, (_, index) => index + 1);
  }
}
