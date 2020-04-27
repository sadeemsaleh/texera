import { TestBed } from '@angular/core/testing';

import { GroupOperatorService } from './group-operator.service';

describe('GroupOperatorService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: GroupOperatorService = TestBed.get(GroupOperatorService);
    expect(service).toBeTruthy();
  });
});
