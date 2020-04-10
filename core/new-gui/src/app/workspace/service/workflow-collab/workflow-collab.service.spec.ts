import { TestBed } from '@angular/core/testing';

import { WorkflowCollabService } from './workflow-collab.service';

describe('WorkflowCollabService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: WorkflowCollabService = TestBed.get(WorkflowCollabService);
    expect(service).toBeTruthy();
  });

  // Think about what tests we should include


  // Initial connection should send something
});
