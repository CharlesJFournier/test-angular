import { Component, AfterViewInit, ViewChild, Input,
        Output, EventEmitter, Inject, OnInit } from '@angular/core';

import {HttpClient} from '@angular/common/http';

import {MatPaginator} from '@angular/material/paginator';
import {MatSort} from '@angular/material/sort';
import {MatTableDataSource} from '@angular/material/table';
import {MatDialog} from '@angular/material/dialog';
import {MatDialogRef} from '@angular/material/dialog';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';

import { BehaviorSubject } from 'rxjs';

import {Observable} from 'rxjs';

import {FormControl} from '@angular/forms';
import {SelectionModel} from '@angular/cdk/collections';
//var html = require('dashboard.component.html').default

//import closeDialogtemplateString from './close_dialog.component.html';

import './dashboard.component.css';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser'

@Component({
  selector: 'app-dashboard',
  template: "dashboard.component.html",
  styleUrls: ['./dashboard.component.css']
})

export class DashboardComponent implements AfterViewInit {
  // Status filter
  statusFilterValue: string = null;

  statusFilterValues = [
    {value: null, viewValue: 'All'},
    {value: 'open', viewValue: 'Open'},
    {value: 'closed', viewValue: 'Closed'},
    {value: 'in_review', viewValue: 'In Review'},
  ];

  // Data
  courtCaseData = null;
  jobsDataSource = null;
  jobData = null;
  dataSource = null;
  courtCaseHttpDao = null;

  // Table config
  displayedColumns = ['select', 'county_court_name', 'case_number', 'defendant_name',
                      'parcel_address', 'jobs', 'affidavit', 'status'];
  displayedJobsCollumns = ['id', 'name', 'county', 'parcel_address', 'party_address', 'case_number', 'job_type', 'order_received_date', 'attempts', 'summons_days_until_expires', 'stat'];
  //county is from court case which is

  selection = new SelectionModel(true, []);
  isLoadingResults: boolean = false;

  displayCourtCaseTable = true;
  displayCourtCaseForm = false;
  displayJobForm = false;

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  constructor(private http: HttpClient, private sanitizer: DomSanitizer, public dialog: MatDialog) {
    this.courtCaseHttpDao = new CourtCaseHttpDao(this.http);
    this.dataSource = new CourtCaseDataSource();

    this.courtCaseHttpDao!.getCourtCases().subscribe(data => {
      data.map(x => {
        x['error_messages'] = [];

        if(x['status'] == 'open') {
          x['error_messages'].push('- The case is not submitted to review or closed');
        }

        if(x['jobs'].filter(x => x['status'] === 0 ).length > 0 ) {
          x['error_messages'].push('- Not all jobs in the case are completed');
        }

        if(!x['plaintiff_name']) {
          x['error_messages'].push('- The case doesn\'t have a plaintiff\'s contact');
        }

        if(!x['county_court_name']) {
          x['error_messages'].push('- The case doesn\'t have a defendant\'s contact');
        }

        if(!x['defendant_name']) {
          x['error_messages'].push('- The case doesn\'t have a county court\'s contact');
        }

        if(!x['county_court_name']) {
          x['error_messages'].push('- _COUNTY_COURT_ERROR__ -');
        }
        return x;
      });
      this.dataSource.data = data;
    });
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  /** Whether the number of selected elements matches the total number of rows. */
  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numFilteredRows = this.dataSource.filteredData.length;
    const numRows = this.dataSource.data.length;

    if(numFilteredRows < numRows) {
      return numSelected === numFilteredRows;
    } else {
      return numSelected === numRows;
    }
  }

  /** Selects all rows if they are not all selected; otherwise clear selection. */
  masterToggle() {
    if(this.isAllSelected()) {
      this.selection.clear();
    } else {
      const numFilteredRows = this.dataSource.filteredData.length;
      const numRows = this.dataSource.data.length;
      if(numFilteredRows < numRows) {
        this.dataSource.filteredData.forEach(row => this.selection.select(row));
      } else {
        this.dataSource.data.forEach(row => this.selection.select(row));
      }
    }
  }

  select(row) {
    this.selection.toggle(row);
  }

  close() {
    var ids = this.selection.selected.map(a =>a.id);
    if (ids.length > 0) {
      //this.openDialog(ids);
    }
  }

  filterStatus(value) {
    this.selection.clear();
    this.paginator.pageIndex = 0;
    this.statusFilterValue = value;
    this.dataSource.statusFilter = value;
  }

  applyFilter(filterValue: string) {
    this.selection.clear();
    this.paginator.pageIndex = 0;
    this.dataSource.filter = filterValue;
    this.dataSource.statusFilter = this.statusFilterValue;
  }

  goToCourtCaseForm(courtCase){
    this.courtCaseData = courtCase;
    this.jobsDataSource = courtCase.jobs;
    console.log(courtCase);


    console.log(this.dataSource);
    console.log(this.jobsDataSource);
    console.log(this.courtCaseData);

    this.displayCourtCaseForm = true;
    this.displayCourtCaseTable = false;
  }

  goToJobForm(job){
    this.jobData = job;
    this.displayJobForm = true;
    this.displayCourtCaseForm = false;
  }

  goToCourtCaseTable(){
    this.courtCaseData = null;
    this.jobsDataSource = null;

    this.displayCourtCaseTable = true;
    this.displayCourtCaseForm = false;
  }
}

export interface CourtCasesApi {
  items: CourtCase[];
  total: number;
}

export interface CourtCase {
  id: number;
  case_number: string;
  status: string;
  parcel_address: string;
  defendant_name: string;
  county_court_name : string;
}

export class CourtCaseHttpDao {
  constructor(private http: HttpClient) {}

  getCourtCases(): Observable<CourtCasesApi> {
    const requestUrl = `/api/v1/court_cases?web`;
    return this.http.get<CourtCasesApi>(requestUrl);
  }

  closeCourtCases(court_case_ids : number[]): Observable<any> {
    const requestUrl = `/api/v1/court_cases/batch_close.json`;
    return this.http.post<any>(requestUrl, { ids: court_case_ids });
  }
}
export class CourtCaseDataSource<T> extends MatTableDataSource<T> {
  private readonly _statusFilter = new BehaviorSubject<string>('');

  get statusFilter(): string { return this._statusFilter.value; }
  set statusFilter(statusFilter: string) { this._statusFilter.next(statusFilter); }

  constructor(initialData: T[] = []) {
    super();

    this._statusFilter.subscribe(statusFilter => {
      this.filter = " " + this.filter
    });
  }

  filterPredicate: ((data: T, filter: string) => boolean) = (data: T, filter: string): boolean => {
    // Transform the data into a lowercase string of all property values.
    const accumulator = (currentTerm, key) => {
      if (key == 'jobs' || key == 'error_messages') {
        return currentTerm;
      } else {
        return currentTerm + data[key];
      }
    }

    const dataStr = Object.keys(data).reduce(accumulator, '').toLowerCase();
    const transformedFilter = filter.trim().toLowerCase();

    if (this.statusFilter) {
      return dataStr.indexOf(transformedFilter) != -1 && dataStr.indexOf(this.statusFilter) != -1;
    } else {
      return dataStr.indexOf(transformedFilter) != -1;
    }
  }
}
