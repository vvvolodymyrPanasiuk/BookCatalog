import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { Sort } from '@angular/material/sort';
import { MatSnackBar } from '@angular/material/snack-bar';

import { Book } from 'src/app/core/models/book';
import { SortingRequestParam } from 'src/app/core/models/sortingRequestParam';
import { FilteringService } from 'src/app/core/services/filtering/filtering.service';
import { SearchService } from 'src/app/core/services/search/search.service';
import { SortingService } from 'src/app/core/services/sorting/sorting.service';
import { BookDialogComponent } from '../book-dialog/book-dialog.component';
import { BooksService } from 'src/app/core/services/books/books.service';
import { LocalStorageService } from 'src/app/core/services/storage/local-storage.service';
import { BookExportBottomSheetComponent } from '../book-export-bottom-sheet/book-export-bottom-sheet.component';

@Component({
  selector: 'app-books',
  templateUrl: './books.component.html',
  styleUrls: ['./books.component.css']
})
export class BooksComponent implements AfterViewInit {

  public books?: Book[];
  private tempIsUpd?: boolean;
  public editingBookId?: string | null = null;

  public displayedColumns: string[] = ['id', 'title', 'publicationDate', 'description', 'pageCount', 'actions'];
  public dataSource = new MatTableDataSource<Book>(this.books);
  sortedData?: Book[]; //for sorting local data
  @ViewChild(MatPaginator) _paginator!: MatPaginator;

  private searchTerms = new Subject<string>();
  public selectedSortOption: any = 7; // Store the selected sorting (default = NO SORT)
  public selectedDateRange: string = ''; // Store the selected date range
  public customStartDate: string = '';
  public customEndDate: string = '';

  constructor(
    private bookService: BooksService,
    private searchService: SearchService,
    private sortingService: SortingService,
    private filteringService: FilteringService,
    private dialog: MatDialog,
    private localStorageService: LocalStorageService,
    private bottomSheet: MatBottomSheet,
    private snackBar: MatSnackBar
  ) { }


  ngOnInit(): void {
    this.dataSource = new MatTableDataSource<Book>([]);
    this.getAllBooks();

    if (localStorage.length > 0) {
      if (this.tempIsUpd) {
        const formData = this.localStorageService.getFormData('bookDialogFormData');
        this.openBookUpdateDialog(formData);
      } else {
        this.openBookCreateDialog();
      }
    }

    this.searchTerms.pipe(
      debounceTime(300),
      switchMap((term: string) => {
        if (term.trim() === '') {
          return this.bookService.getAllBooks();
        } else {
          return this.searchService.searchBooks(term);
        }
      })
    ).subscribe((result: Book[]) => {
      this.books = result;
      this.dataSource.data = result;
    }, error => console.error(error));
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this._paginator;
  }


  //#region search

  search(event: Event): void {
    const term = (event.target as HTMLInputElement).value;
    this.searchTerms.next(term);
  }

  //#endregion


  //#region sorting

  sort(): void {
    const sortOptions: { [id: number]: SortingRequestParam } = {
      1: { field: 'title', ascending: true },
      2: { field: 'title', ascending: false },
      3: { field: 'publicationdate', ascending: true },
      4: { field: 'publicationdate', ascending: false },
      5: { field: 'pagecount', ascending: true },
      6: { field: 'pagecount', ascending: false },
      7: { field: '', ascending: true } //
    };

    const selectedOption = sortOptions[this.selectedSortOption];

    if (selectedOption && this.selectedSortOption != 7) {
      this.sortingService
        .sortBooks(selectedOption.field, selectedOption.ascending)
        .subscribe(
          (result: Book[]) => {
            this.books = result;
            this.dataSource.data = result;
          },
          (error) => console.error(error)
        );
    } else {
      this.getAllBooks();
    }
  }

  sortLocalData(sort: Sort) {
    const data = this.books?.slice();
    if (!sort.active || sort.direction === '') {
      this.sortedData = data;
      return;
    }

    this.sortedData = data?.sort((a, b) => {
      const isAsc = sort.direction === 'asc';
      switch (sort.active) {
        case 'id':
          return compare(a.id, b.id, isAsc);
        case 'title':
          return compare(a.title, b.title, isAsc);
        case 'publicationDate':
          return compare(a.publicationDate, b.publicationDate, isAsc);
        case 'description':
          return compare(a.description, b.description, isAsc);
        case 'pageCount':
          return compare(a.pageCount, b.pageCount, isAsc);
        default:
          return 0;
      }
    });

    if (this.sortedData !== undefined) {
      this.dataSource.data = this.sortedData;
    }
  }

  //#endregion


  //#region filtering

  selectDateRange(range: string): void {
    this.selectedDateRange = range;

    switch (range) {
      case 'custom':
        this.applyCustomDateFilter();
        break;
      case 'thisMonth':
        this.filterBooksThisMonth();
        break;
      case 'thisYear':
        this.filterBooksThisYear();
        break;
      default:
        this.getAllBooks();
        break;
    }
  }

  private filterBooksThisMonth(): void {
    this.filteringService.filterBooksThisMonth().subscribe(
      (result: Book[]) => {
        this.books = result;
        this.dataSource.data = result;
      },
      (error) => console.error(error)
    );
  }

  private filterBooksThisYear(): void {
    this.filteringService.filterBooksThisYear().subscribe(
      (result: Book[]) => {
        this.books = result;
        this.dataSource.data = result;
      },
      (error) => console.error(error)
    );
  }

  dateRangeChange(dateRangeStart: HTMLInputElement, dateRangeEnd: HTMLInputElement) {

    const startDateParts = dateRangeStart.value.split('/');
    const endDateParts = dateRangeEnd.value.split('/');

    if (startDateParts.length === 3 && endDateParts.length === 3) {
      const formattedStartDate = `${startDateParts[0]}.${startDateParts[1]}.${startDateParts[2]}`;
      const formattedEndDate = `${endDateParts[0]}.${endDateParts[1]}.${endDateParts[2]}`;

      this.customStartDate = formattedStartDate;
      this.customEndDate = formattedEndDate;

    } else {
      console.error('Invalid date format');
    }
  }

  applyCustomDateFilter(): void {
    if (this.customStartDate && this.customEndDate) {
      this.filteringService
        .filterBooksByDateRange(this.customStartDate, this.customEndDate)
        .subscribe(
          (result: Book[]) => {
            this.books = result;
            this.dataSource.data = result;
          },
          (error) => console.error(error)
        );
    }
  }

  //#endregion


  //#region CRUD

  getAllBooks() {
    this.bookService.getAllBooks().subscribe(
      (result: Book[]) => {
        this.books = result;
        this.dataSource.data = result;
      },
      (error) => console.error(error)
    );
  }

  createBook() {
    this.openBookCreateDialog();
  }

  editBook(book: Book) {
    this.openBookUpdateDialog(book);
  }

  deleteBook(book: Book) {
    if (book.id != null) {
      this.bookService.deleteBook(book.id).subscribe(
        () => {
          this.getAllBooks();
          this.snackBar.open(`${book.title} was deleted`, "OK");
        },
        (error) => console.error(error)
      );
    }
  }

  private openBookUpdateDialog(book: Book) {
    this.tempIsUpd = false;
    this.editingBookId = book.id; // Зберігання ID редагованої книги

    const dialogRef = this.dialog.open(BookDialogComponent, {
      width: '400px',
      data: { book: book, isEdit: true }
    });

    dialogRef.afterClosed().subscribe(result => {
      this.editingBookId = null;
      if (!(result === undefined)) {
        console.log('The dialog was closed');
        this.getAllBooks();
      }
    });
  }

  private openBookCreateDialog() {
    this.tempIsUpd = false;

    const dialogRef = this.dialog.open(BookDialogComponent, {
      width: '400px',
      data: { book: null, isEdit: false }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!(result === undefined)) {
        console.log('The dialog was closed');
        this.getAllBooks();
      }
    });
  }

  //#endregion


  //#region Import

  openBottomSheet(): void {
    if (this.books) {
      const bottomSheetRef = this.bottomSheet.open(BookExportBottomSheetComponent, {
        data: { books: this.books },
      });
    }
  }

  //#endregion

}


function compare(a?: number | string, b?: number | string, isAsc?: boolean) {
  if (a && b) {
    return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
  }
  else { return 0 }
}
