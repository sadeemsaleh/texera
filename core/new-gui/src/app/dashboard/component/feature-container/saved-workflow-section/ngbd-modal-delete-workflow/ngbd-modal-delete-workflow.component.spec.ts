// import { async, ComponentFixture, TestBed } from '@angular/core/testing';
//
// import { MatDialogModule } from '@angular/material/dialog';
//
// import { NgbActiveModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
// import { FormsModule } from '@angular/forms';
//
// import { HttpClientModule } from '@angular/common/http';
//
// import { NgbdModalDeleteWorkflowComponent } from './ngbd-modal-delete-workflow.component';
// import { Workflow } from '../../../../../common/type/workflow';
// import { WorkflowCacheService } from '../../../../../workspace/service/cache-workflow/workflow-cache.service';
//
// describe('NgbdModalDeleteProjectComponent', () => {
//   let component: NgbdModalDeleteWorkflowComponent;
//   let fixture: ComponentFixture<NgbdModalDeleteWorkflowComponent>;
//
//   const deleteComponent: NgbdModalDeleteWorkflowComponent;
//   const deleteFixture: ComponentFixture<NgbdModalDeleteWorkflowComponent>;
//
//   beforeEach(async(() => {
//     TestBed.configureTestingModule({
//       declarations: [NgbdModalDeleteWorkflowComponent],
//       providers: [
//         NgbActiveModal
//       ],
//       imports: [
//         MatDialogModule,
//         NgbModule,
//         FormsModule,
//         HttpClientModule]
//     })
//       .compileComponents();
//   }));
//
//   beforeEach(() => {
//     fixture = TestBed.createComponent(NgbdModalDeleteWorkflowComponent);
//     component = fixture.componentInstance;
//   });
//
//   it('should create', () => {
//     expect(component).toBeTruthy();
//   });
//   //
//   // it('deleteProjectComponent deleteSavedProject should delete project in list', () => {
//   //   deleteFixture = TestBed.createComponent(NgbdModalDeleteWorkflowComponent);
//   //   deleteComponent = deleteFixture.componentInstance;
//   //
//   //   let getBool: Boolean;
//   //   getBool = false;
//   //
//   //   deleteComponent.workflow = {wid: 1};
//   //   deleteComponent.confirmDelete();
//   //
//   //   expect(getBool).toEqual(false);
//   // });
// });
