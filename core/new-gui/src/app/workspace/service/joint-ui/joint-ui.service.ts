import { Injectable } from '@angular/core';
import { OperatorMetadataService } from '../operator-metadata/operator-metadata.service';
import { OperatorSchema } from '../../types/operator-schema.interface';

import * as joint from 'jointjs';
import { Point, OperatorPredicate, OperatorLink } from '../../types/workflow-common.interface';
import { OperatorStates } from '../../types/execute-workflow.interface';
import { Statistics } from '../../types/execute-workflow.interface';
import { Group, GroupBoundingBox } from '../workflow-graph/model/operator-group';

/**
 * Defines the SVG path for the delete button
 */
export const deleteButtonPath =
  'M14.59 8L12 10.59 9.41 8 8 9.41 10.59 12 8 14.59 9.41 16 12 13.41' +
  ' 14.59 16 16 14.59 13.41 12 16 9.41 14.59 8zM12 2C6.47 2 2 6.47 2' +
  ' 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z';

/**
 * Defines the HTML SVG element for the delete button and customizes the look
 */
export const deleteButtonSVG =
  `<svg class="delete-button" height="24" width="24">
    <path d="M0 0h24v24H0z" fill="none" pointer-events="visible" />
    <path d="${deleteButtonPath}"/>
  </svg>`;

/**
 * Defines the SVG path for the collapse button
 */
export const collapseButtonPath =
  'M4 7 H12 v2 H4 z' +
  ' M0 3 Q0 0 3 0 h10 Q16 0 16 3 v10 H14 V3 Q14 2 13 2 H3 Q2 2 2 3 z' +
  ' M0 3 v10 Q0 16 3 16 h10 Q16 16 16 13 H14 Q14 14 13 14 H3 Q2 14 2 13 V3 z';

/**
 * Defines the HTML SVG element for the collapse button and customizes the look
 */
export const collapseButtonSVG =
  `<svg class="collapse-button" height="16" width="16">
    <path d="M0 0 h16 v16 H0 z" fill="none" pointer-events="visible" />
    <path d="${collapseButtonPath}" />
  </svg>`;

/**
 * Defines the SVG path for the expand button
 */
export const expandButtonPath =
  'M4 7 h3 V4 h2 V7 h3 v2 h-3 V12 h-2 V9 h-3 z' +
  ' M0 3 Q0 0 3 0 h10 Q16 0 16 3 v10 H14 V3 Q14 2 13 2 H3 Q2 2 2 3 z' +
  ' M0 3 v10 Q0 16 3 16 h10 Q16 16 16 13 H14 Q14 14 13 14 H3 Q2 14 2 13 V3 z';

/**
 * Defines the HTML SVG element for the expand button and customizes the look
 */
export const expandButtonSVG =
  `<svg class="expand-button" height="16" width="16">
    <path d="M0 0 h16 v16 H0 z" fill="none" pointer-events="visible" />
    <path d="${expandButtonPath}" />
  </svg>`;

/**
 * Defines the handle (the square at the end) of the source operator for a link
 */
export const sourceOperatorHandle = 'M 0 0 L 0 8 L 8 8 L 8 0 z';

/**
 * Defines the handle (the arrow at the end) of the target operator for a link
 */
export const targetOperatorHandle = 'M 12 0 L 0 6 L 12 12 z';

/**
 * Extends a basic Joint operator element and adds our own HTML markup.
 * Our own HTML markup includes the SVG element for the delete button,
 *   which will show a red delete button on the top right corner
 */
class TexeraCustomJointElement extends joint.shapes.devs.Model {
  markup =
    `<g class="element-node">
      <text id="operatorStates"></text>
      <rect class="body"></rect>
      ${deleteButtonSVG}
      <image></image>
      <text id="operatorName"></text>
    </g>`;
}

/**
 * Extends a basic Joint shape element and adds our own HTML markup.
 */
class TexeraCustomOperatorStatusTooltipElement extends joint.shapes.devs.Model {
  markup =
  `<g class="element-node">
    <polygon class="body"></polygon>
    <text id = "operatorCount"></text>
    <text id = "operatorSpeed"></text>
  </g>`;
}

/**
 * Extends a basic Joint shape element and adds our own HTML markup.
 */
class TexeraCustomGroupElement extends joint.shapes.devs.Model {
  markup =
    `<g class="element-node">
      <rect class="body"></rect>
      ${collapseButtonSVG}
      ${expandButtonSVG}
    </g>`;
}

/**
 * JointUIService controls the shape of an operator and a link
 *  when they are displayed by JointJS.
 *
 * This service alters the basic JointJS element by:
 *  - setting the ID of the JointJS element to be the same as Texera's OperatorID
 *  - changing the look of the operator box (size, colors, lines, etc..)
 *  - adding input and output ports to the box based on the operator metadata
 *  - changing the SVG element and CSS styles of operators, links, ports, etc..
 *  - adding a new delete button and the callback function of the delete button,
 *      (original JointJS element doesn't have a built-in delete button)
 *
 * @author Henry Chen
 * @author Zuozhi Wang
 */
@Injectable()
export class JointUIService {

  public static readonly DEFAULT_OPERATOR_WIDTH = 60;
  public static readonly DEFAULT_OPERATOR_HEIGHT = 60;

  public static readonly DEFAULT_TOOLTIP_WIDTH = 140;
  public static readonly DEFAULT_TOOLTIP_HEIGHT = 60;

  public static readonly DEFAULT_GROUP_MARGIN = 40;

  private operators: ReadonlyArray<OperatorSchema> = [];

  constructor(
    private operatorMetadataService: OperatorMetadataService,
  ) {
    // initialize the operator information
    // subscribe to operator metadata observable
    this.operatorMetadataService.getOperatorMetadata().subscribe(
      value => this.operators = value.operators
    );

  }

  /**
   * Gets the JointJS UI Element object based on the operator predicate.
   * A JointJS Element could be added to the JointJS graph to let JointJS display the operator accordingly.
   *
   * The function checks if the operatorType exists in the metadata,
   *  if it doesn't, the program will throw an error.
   *
   * The function returns an element that has our custom style,
   *  which are specified in getCustomOperatorStyleAttrs() and getCustomPortStyleAttrs()
   *
   *
   * @param operatorType the type of the operator
   * @param operatorID the ID of the operator, the JointJS element ID would be the same as operatorID
   * @param xPosition the topleft x position of the operator element (relative to JointJS paper, not absolute position)
   * @param yPosition the topleft y position of the operator element (relative to JointJS paper, not absolute position)
   *
   * @returns JointJS Element
   */
  public getJointOperatorElement(
    operator: OperatorPredicate, point: Point
  ): joint.dia.Element {

    // check if the operatorType exists in the operator metadata
    const operatorSchema = this.operators.find(op => op.operatorType === operator.operatorType);
    if (operatorSchema === undefined) {
      throw new Error(`operator type ${operator.operatorType} doesn't exist`);
    }

    // construct a custom Texera JointJS operator element
    //   and customize the styles of the operator box and ports
    const operatorElement = new TexeraCustomJointElement({
      position: point,
      size: { width: JointUIService.DEFAULT_OPERATOR_WIDTH, height: JointUIService.DEFAULT_OPERATOR_HEIGHT },
      attrs: JointUIService.getCustomOperatorStyleAttrs(operatorSchema.additionalMetadata.userFriendlyName, operatorSchema.operatorType),
      ports: {
        groups: {
          'in': { attrs: JointUIService.getCustomPortStyleAttrs() },
          'out': { attrs: JointUIService.getCustomPortStyleAttrs() }
        }
      }
    });

    // set operator element ID to be operator ID
    operatorElement.set('id', operator.operatorID);

    // set the input ports and output ports based on operator predicate
    operator.inputPorts.forEach(
      port => operatorElement.addInPort(port)
    );
    operator.outputPorts.forEach(
      port => operatorElement.addOutPort(port)
    );

    return operatorElement;
  }

  /**
   * Gets the JointJS UI element object for a operator statistics popup window
   * @param operator the predicate of the base operator
   * @param point the position of the tooltip
   */
  public getJointOperatorStatusTooltipElement(
    operator: OperatorPredicate, point: Point
  ): joint.dia.Element {
      // check if the operatorType exists in the operator metadata
    const operatorSchema = this.operators.find(op => op.operatorType === operator.operatorType);
    if (operatorSchema === undefined) {
      throw new Error(`operator type ${operator.operatorType} doesn't exist`);
    }
    // set the tooltip point to set the default position relative to the operator
    const tooltipPoint = {x: point.x - JointUIService.DEFAULT_OPERATOR_WIDTH / 2 - 10,
       y: point.y - JointUIService.DEFAULT_OPERATOR_HEIGHT};

    const toolTipElement = new TexeraCustomOperatorStatusTooltipElement({
      position: tooltipPoint,
      size: {width: JointUIService.DEFAULT_TOOLTIP_WIDTH, height: JointUIService.DEFAULT_TOOLTIP_HEIGHT},
      attrs: JointUIService.getCustomOperatorStatusTooltipStyleAttrs()
    });

    toolTipElement.set('id', JointUIService.getOperatorStatusTooltipElementID(operator.operatorID));
    return toolTipElement;
  }

  /**
   * Gets the JointJS UI Element object based on the group.
   * A JointJS Element could be added to the JointJS graph to let JointJS display the group accordingly.
   *
   * The function returns an element that has our custom style,
   *  which is specified in getCustomGroupStyleAttrs().
   *
   * @param group
   * @param topLeft the position of the operator (if there was one) that's in the top left corner of the group
   * @param bottomRight the position of the operator (if there was one) that's in the bottom right corner of the group
   */
  public getJointGroupElement(group: Group, boundingBox: GroupBoundingBox): joint.dia.Element {
    const {topLeft, bottomRight} = boundingBox;

    const groupElementPosition = {x: topLeft.x - JointUIService.DEFAULT_GROUP_MARGIN,
      y: topLeft.y - JointUIService.DEFAULT_GROUP_MARGIN};
    const widthMargin = JointUIService.DEFAULT_OPERATOR_WIDTH + 2 * JointUIService.DEFAULT_GROUP_MARGIN;
    const heightMargin = JointUIService.DEFAULT_OPERATOR_HEIGHT + 2 * JointUIService.DEFAULT_GROUP_MARGIN;

    const groupElement = new TexeraCustomGroupElement({
      position: groupElementPosition,
      size: {width: bottomRight.x - topLeft.x + widthMargin, height: bottomRight.y - topLeft.y + heightMargin},
      attrs: JointUIService.getCustomGroupStyleAttrs(bottomRight.x - topLeft.x + widthMargin)
    });

    groupElement.set('id', group.groupID);
    return groupElement;
  }

  // remove attr 'display: none' to show a tooltip
  public showOperatorStatusToolTip(jointPaper: joint.dia.Paper, tooltipID: string): void {
    jointPaper.getModelById(tooltipID).removeAttr('polygon/display');
    jointPaper.getModelById(tooltipID).removeAttr('#operatorCount/display');
    jointPaper.getModelById(tooltipID).removeAttr('#operatorSpeed/display');
  }

  // add attr 'display: none' to hide a tooltip
  public hideOperatorStatusToolTip(jointPaper: joint.dia.Paper, tooltipID: string): void {
    jointPaper.getModelById(tooltipID).attr('polygon/display', 'none');
    jointPaper.getModelById(tooltipID).attr('#operatorCount/display', 'none');
    jointPaper.getModelById(tooltipID).attr('#operatorSpeed/display', 'none');
  }

  // change content of tooltip
  public changeOperatorStatusTooltipInfo(jointPaper: joint.dia.Paper, tooltipID: string, stats: Statistics) {
    jointPaper.getModelById(tooltipID).attr('#operatorCount/text', 'Output:' + stats.outputCount + ' tuples');
    jointPaper.getModelById(tooltipID).attr('#operatorSpeed/text', 'Speed:' + stats.speed + ' tuples/s');
  }

  // change operator state name and color
  public changeOperatorStates(jointPaper: joint.dia.Paper, operatorID: string, status: OperatorStates): void {
      jointPaper.getModelById(operatorID).attr('#operatorStates/text', OperatorStates[status]);
      switch (status) {
        case OperatorStates.Completed: {
          jointPaper.getModelById(operatorID).attr('#operatorStates/fill', 'green');
          break;
        }
        case OperatorStates.Pausing:
        case OperatorStates.Paused: {
          jointPaper.getModelById(operatorID).attr('#operatorStates/fill', 'red');
          break;
        }
        default: {
          jointPaper.getModelById(operatorID).attr('#operatorStates/fill', 'orange');
        }
      }
  }

  /**
   * Hides the expand button and shows the collapse button of
   * the given group on joint paper.
   *
   * @param jointPaper
   * @param groupID
   */
  public hideGroupExpandButton(jointPaper: joint.dia.Paper, groupID: string): void {
    jointPaper.getModelById(groupID).attr('.expand-button/display', 'none');
    jointPaper.getModelById(groupID).removeAttr('.collapse-button/display');
  }

  /**
   * Hides the collapse button and shows the expand button of
   * the given group on joint paper.
   *
   * @param jointPaper
   * @param groupID
   */
  public hideGroupCollapseButton(jointPaper: joint.dia.Paper, groupID: string): void {
    jointPaper.getModelById(groupID).attr('.collapse-button/display', 'none');
    jointPaper.getModelById(groupID).removeAttr('.expand-button/display');
  }

  /**
   * Repositions the collapse button of the given group according
   * to the group's (new) width.
   *
   * @param jointPaper
   * @param groupID
   * @param width
   */
  public repositionGroupCollapseButton(jointPaper: joint.dia.Paper, groupID: string, width: number): void {
    jointPaper.getModelById(groupID).attr('.collapse-button/x', `${width - 23}`);
  }

  /**
   * This method will change the operator's color based on the validation status
   *  valid  : default color
   *  invalid: red
   *
   * @param jointPaper
   * @param operatorID
   * @param status
   */
  public changeOperatorColor(jointPaper: joint.dia.Paper, operatorID: string, isOperatorValid: boolean): void {
    if (isOperatorValid) {
      jointPaper.getModelById(operatorID).attr('rect/stroke', '#CFCFCF');
    } else {
      jointPaper.getModelById(operatorID).attr('rect/stroke', 'red');
    }
  }

  /**
   * Gets the ID of the JointJS operator status tooltip element corresponding to an operator.
   */
  public static getOperatorStatusTooltipElementID(operatorID: string): string {
    return 'tooltip-' + operatorID;
  }

  /**
   * This function converts a Texera source and target OperatorPort to
   *   a JointJS link cell <joint.dia.Link> that could be added to the JointJS.
   *
   * @param source the OperatorPort of the source of a link
   * @param target the OperatorPort of the target of a link
   * @returns JointJS Link Cell
   */
  public static getJointLinkCell(
    link: OperatorLink
  ): joint.dia.Link {
    const jointLinkCell = JointUIService.getDefaultLinkCell();
    jointLinkCell.set('source', { id: link.source.operatorID, port: link.source.portID });
    jointLinkCell.set('target', { id: link.target.operatorID, port: link.target.portID });
    jointLinkCell.set('id', link.linkID);
    return jointLinkCell;
  }

  /**
   * This function will creates a custom JointJS link cell using
   *  custom attributes / styles to display the operator.
   *
   * This function defines the svg properties for each part of link, such as the
   *   shape of the arrow or the link. Other styles are defined in the
   *   "app/workspace/component/workflow-editor/workflow-editor.component.scss".
   *
   * The reason for separating styles in svg and css is that while we can
   *   change the shape of the operators in svg, according to JointJS official
   *   website, https://resources.jointjs.com/tutorial/element-styling ,
   *   CSS properties have higher precedence over SVG attributes.
   *
   * As a result, a separate css/scss file is required to override the default
   * style of the operatorLink.
   *
   * @returns JointJS Link
   */
  public static getDefaultLinkCell(): joint.dia.Link {
    const link = new joint.dia.Link({
      router: {
        name: 'manhattan'
      },
      connector: {
        name: 'rounded'
      },
      toolMarkup:
        `<g class="link-tool">
          <g class="tool-remove" event="tool:remove">
          <circle r="11" />
            <path transform="scale(.8) translate(-16, -16)" d="M24.778,21.419 19.276,15.917 24.777
            10.415 21.949,7.585 16.447,13.087 10.945,7.585 8.117,10.415 13.618,15.917 8.116,21.419
            10.946,24.248 16.447,18.746 21.948,24.248z"/>
            <title>Remove link.</title>
            </g>
          </g>`,
      attrs: {
        '.connection-wrap': {
          'stroke-width': 0
        },
        '.marker-source': {
          d: sourceOperatorHandle,
          stroke: 'none',
          fill: '#919191'
        },
        '.marker-arrowhead-group-source .marker-arrowhead': {
          d: sourceOperatorHandle,
        },
        '.marker-target': {
          d: targetOperatorHandle,
          stroke: 'none',
          fill: '#919191'
        },
        '.marker-arrowhead-group-target .marker-arrowhead': {
          d: targetOperatorHandle,
        },
        '.tool-remove': {
          fill: '#D8656A',
          width: 24
        },
        '.tool-remove path': {
          d: deleteButtonPath,
        },
        '.tool-remove circle': {
        }
      }
    });
    return link;
  }

  /**
   * This function changes the default svg of the operator ports.
   * It hides the port label that will display 'out/in' beside the operators.
   *
   * @returns the custom attributes of the ports
   */
  public static getCustomPortStyleAttrs(): joint.attributes.SVGAttributes {
    const portStyleAttrs = {
      '.port-body': {
        fill: '#A0A0A0',
        r: 5,
        stroke: 'none'
      },
      '.port-label': {
        display: 'none'
      }
    };
    return portStyleAttrs;
  }

  /**
   * This function create a custom svg style for the operator
   * @returns the custom attributes of the tooltip.
   */
  public static getCustomOperatorStatusTooltipStyleAttrs(): joint.shapes.devs.ModelSelectors {
    const tooltipStyleAttrs = {
      'element-node': {
        style: {'pointer-events': 'none'}
      },
      'polygon': {
        fill: '#FFFFFF', 'follow-scale': true, stroke: 'purple', 'stroke-width': '2',
        rx: '5px', ry: '5px', refPoints: '0,30 150,30 150,120 85,120 75,150 65,120 0,120',
        display: 'none',
        style: {'pointer-events': 'none'}
      },
      '#operatorCount': {
        fill: '#595959', 'font-size': '12px', ref: 'polygon',
        'y-alignment': 'middle',
        'x-alignment': 'left',
        'ref-x': .05, 'ref-y': .2,
        display: 'none',
        style: {'pointer-events': 'none'}
      },
      '#operatorSpeed': {
        fill: '#595959',
        ref: 'polygon',
        'x-alignment': 'left',
        'font-size': '12px',
        'ref-x': .05, 'ref-y': .5,
        display: 'none',
        style: {'pointer-events': 'none'}
      },
    };
    return tooltipStyleAttrs;
  }

  /**
   * This function creates a custom svg style for the operator.
   * This function also makes the delete button defined above to emit the delete event that will
   *   be captured by JointJS paper using event name *element:delete*
   *
   * @param operatorDisplayName the name of the operator that will display on the UI
   * @returns the custom attributes of the operator
   */
  public static getCustomOperatorStyleAttrs(operatorDisplayName: string,
    operatorType: string): joint.shapes.devs.ModelSelectors {
    const operatorStyleAttrs = {
      '#operatorStates': {
        text:  'Ready' , fill: 'green', 'font-size': '14px', 'visible' : false,
        'ref-x': 0.5, 'ref-y': -10, ref: 'rect', 'y-alignment': 'middle', 'x-alignment': 'middle'
      },
      'rect': {
        fill: '#FFFFFF', 'follow-scale': true, stroke: 'red', 'stroke-width': '2',
        rx: '5px', ry: '5px'
      },
      '#operatorName': {
        text: operatorDisplayName, fill: '#595959', 'font-size': '14px',
        'ref-x': 0.5, 'ref-y': 80, ref: 'rect', 'y-alignment': 'middle', 'x-alignment': 'middle'
      },
      '.delete-button': {
        x: 60, y: -20, cursor: 'pointer',
        fill: '#D8656A', event: 'element:delete'
      },
      'image': {
        'xlink:href': 'assets/operator_images/' + operatorType + '.png',
        width: 35, height: 35,
        'ref-x': .5, 'ref-y': .5,
        ref: 'rect',
        'x-alignment': 'middle',
        'y-alignment': 'middle',

      },
    };
    return operatorStyleAttrs;
  }

  /**
   * This function creates a custom svg style for the group.
   * This function also makes collapse button and expand button defined above to emit
   *   the collapse event and expand event that will be captured by JointJS paper
   *   using event names *element:collapse* and *element:expand*
   *
   * @param width width of the group (used to position the collapse button)
   * @returns the custom attributes of the group
   */
  public static getCustomGroupStyleAttrs(width: number): joint.shapes.devs.ModelSelectors {
    const groupStyleAttrs = {
      'rect': {
        fill: '#F2F4F5', 'follow-scale': true, stroke: '#CED4D9', 'stroke-width': '2',
        rx: '5px', ry: '5px'
      },
      '.collapse-button': {
        x: width - 23, y: 6, cursor: 'pointer',
        fill: '#728393', event: 'element:collapse'
      },
      '.expand-button': {
        x: 147, y: 6, cursor: 'pointer',
        fill: '#728393', event: 'element:expand',
        display: 'none'
      }
    };
    return groupStyleAttrs;
  }

}
