import { TestBed } from '@angular/core/testing';

import { ActionTraceService } from './action-trace.service';

describe('ActionTraceService', () => {
  let service: ActionTraceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ActionTraceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
