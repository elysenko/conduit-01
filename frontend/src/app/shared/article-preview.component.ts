import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Article } from '../core/models';
import { FavoriteButtonComponent } from './favorite-button.component';

@Component({
  selector: 'app-article-preview',
  imports: [RouterLink, DatePipe, FavoriteButtonComponent],
  templateUrl: './article-preview.component.html',
  styleUrl: './article-preview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticlePreviewComponent {
  @Input({ required: true }) article!: Article;
  @Output() readonly favoriteToggled = new EventEmitter<Article>();
}
