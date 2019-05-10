/**
 * @fileOverview Sector
 */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import pureRender from '../util/PureRender';
import { PRESENTATION_ATTRIBUTES, getPresentationAttributes,
  filterEventAttributes } from '../util/ReactUtils';
import { polarToCartesian, RADIAN } from '../util/PolarUtils';
import { getPercentValue, mathSign } from '../util/DataUtils';

const getDeltaAngle = (startAngle, endAngle) => {
  const sign = mathSign(endAngle - startAngle);
  const deltaAngle = Math.min(Math.abs(endAngle - startAngle), 359.999);

  return sign * deltaAngle;
};

const getTangentCircle = ({ cx, cy, radius, angle, sign, isExternal,
  cornerRadius }) => {
  const centerRadius = cornerRadius * (isExternal ? 1 : -1) + radius;
  const theta = Math.asin(cornerRadius / centerRadius) / RADIAN;
  const centerAngle = angle + sign * theta;
  const center = polarToCartesian(cx, cy, centerRadius, centerAngle);
  // The coordinate of point which is tangent to the circle
  const circleTangency = polarToCartesian(cx, cy, radius, centerAngle);
  // The coordinate of point which is tangent to the radius line
  const lineTangency = polarToCartesian(
    cx, cy, centerRadius * Math.cos(theta * RADIAN), angle);

  return { center, circleTangency, lineTangency, theta };
};

/*
  This draws the regular radial bar with square edges.
  - cx: is the x component of the center of the radial chart.
  - cy: is the y component of the center of the radial chart.
  - innerRadius: is the radius of the inner circumference of the radial bar.
  - outerRadius: is the radius of the outer circumference of the radial bar.
  - startAngle: the radial bar can start at any point of the circumference.
  - endAngle: where the radial bar ends.
*/
const getSectorPath = ({ cx, cy, innerRadius, outerRadius, startAngle, endAngle }) => {
  // The length in degrees of the radial bar.
  const angle = getDeltaAngle(startAngle, endAngle);

  // When the angle of sector equals to 360, star point and end point coincide
  const tempEndAngle = startAngle + angle;

  // Given the center, the radius and the start angle we get the coordinate
  // where the radial bar should start. And the same with the end of the
  // radial bar.
  const outerStartPoint = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEndPoint = polarToCartesian(cx, cy, outerRadius, tempEndAngle);

  // First line: start drawing at the start point coordinates.
  // Second line: draw the arc that is the outer edge of the radial bar,
  //    the `outerRadius` is repeated for X and Y radius of the arc. Last "0"
  //    means "no x-axis rotation".
  // Third line: left half is "1" if the angle to draw is greater than 180º,
  //    if is 180º or less, then "0". Right half is the "sweep-flag". There's
  //    a handy chart which explains this in MDN.
  // Last line: position where the drawing ends.
  let path = `M ${outerStartPoint.x},${outerStartPoint.y}
    A ${outerRadius},${outerRadius},0,
    ${+(Math.abs(angle) > 180)},${+(startAngle > tempEndAngle)},
    ${outerEndPoint.x},${outerEndPoint.y}
  `;

  // If the inner radius is positive it means the radial bar is a bar indeed,
  // meaning theres another curve we have to draw to complete the radial bar.
  if (innerRadius > 0) {
    // Calculate the position where the inner curve of the bar ends.
    const innerStartPoint = polarToCartesian(cx, cy, innerRadius, startAngle);
    const innerEndPoint = polarToCartesian(cx, cy, innerRadius, tempEndAngle);
    // First line: draw a straight line from the end of the outer curve to the
    //   end of the inner curve, this way we continue the drawing from the
    //   last step.
    // The rest is the same as the first curve, we draw an arc from the end
    // of the inner curve to the beginning, and finally the "Z" command ends
    // automatically the drawing, instead of drawing a line.
    path += `L ${innerEndPoint.x},${innerEndPoint.y}
            A ${innerRadius},${innerRadius},0,
            ${+(Math.abs(angle) > 180)},${+(startAngle <= tempEndAngle)},
            ${innerStartPoint.x},${innerStartPoint.y} Z`;
  } else {
    path += `L ${cx},${cy} Z`;
  }

  return path;
};

// Same as getSectorPath but also receives the prop "cornerRadius".
const getSectorWithCorner = ({ cx, cy, innerRadius, outerRadius, cornerRadius, forceCornerRadius,
  startAngle, endAngle }) => {

  // Just a guess but if there's a chart that starts at 0 degrees and ends
  // at 180 (counter clockwise) for the positive values, the negative values
  // would go down, in clockwise direction.
  const sign = mathSign(endAngle - startAngle);

  // (See annotated chart image)
  // "soct": circle tangency for the start of the outer edge of radial bar.
  // "solt": line tangency for the start of the outer edge of radial bar.
  const { circleTangency: soct, lineTangency: solt, theta: sot } =
    getTangentCircle({
      cx, cy, radius: outerRadius, angle: startAngle, sign, cornerRadius,
    });

  // (See annotated chart image)
  // "eoct": circle tangency for the end of the outer edge of radial bar.
  // "eolt": line tangency for the end of the outer edge of radial bar.
  const { circleTangency: eoct, lineTangency: eolt, theta: eot } =
    getTangentCircle({
      cx, cy, radius: outerRadius, angle: endAngle, sign: -sign, cornerRadius,
    });

  const outerArcAngle = Math.abs(startAngle - endAngle) - sot - eot;

  // The radial bar is too short to hold the rounded corners,
  // so lets draw a circle instead.
  if (outerArcAngle < 0) {
    if (forceCornerRadius) {
      return `M ${solt.x},${solt.y}
        a${cornerRadius},${cornerRadius},0,0,1,${cornerRadius * 2},0
        a${cornerRadius},${cornerRadius},0,0,1,${-cornerRadius * 2},0
      `;
    }
    return getSectorPath({
      cx, cy, innerRadius, outerRadius, startAngle, endAngle,
    });
  }

  // Draw the outer edge of the radial bar, beginning with the corner radius.
  // Here I need to modify the starting point to be outside the square radial bar.
  let path = `M ${solt.x},${solt.y}
    A${cornerRadius},${cornerRadius},0,0,${+(sign < 0)},${soct.x},${soct.y}
    A${outerRadius},${outerRadius},0,${+(outerArcAngle > 180)},${+(sign < 0)},${eoct.x},${eoct.y}
    A${cornerRadius},${cornerRadius},0,0,${+(sign < 0)},${eolt.x},${eolt.y}
  `;

  // Draw the inner edge of the radial bar, if applicable.
  if (innerRadius > 0) {

    // (See annotated chart image)
    // "sict": circle tangency for the start of the inner edge of radial bar.
    // "silt": line tangency for the start of the inner edge of radial bar.
    const { circleTangency: sict, lineTangency: silt, theta: sit } =
      getTangentCircle({
        cx, cy, radius: innerRadius, angle: startAngle, sign, isExternal: true, cornerRadius,
      });

    // (See annotated chart image)
    // "eict": circle tangency for the end of the inner edge of radial bar.
    // "eilt": line tangency for the end of the inner edge of radial bar.
    const { circleTangency: eict, lineTangency: eilt, theta: eit } =
      getTangentCircle({
        cx, cy, radius: innerRadius, angle: endAngle, sign: -sign, isExternal: true, cornerRadius,
      });

    const innerArcAngle = Math.abs(startAngle - endAngle) - sit - eit;

    if (innerArcAngle < 0) {
      return `${path}L${cx},${cy}Z`;
    }

    // And finally we draw the inner edge of the radial bar.
    // This also needs to be adjusted for the starting point to be
    // outside the square radial bar.
    path += `L${eilt.x},${eilt.y}
      A${cornerRadius},${cornerRadius},0,0,${+(sign < 0)},${eict.x},${eict.y}
      A${innerRadius},${innerRadius},0,${+(innerArcAngle > 180)},${+(sign > 0)},${sict.x},${sict.y}
      A${cornerRadius},${cornerRadius},0,0,${+(sign < 0)},${silt.x},${silt.y}Z`;

  } else {
    path += `L${cx},${cy}Z`;
  }

  return path;
};

@pureRender
class Sector extends Component {

  static displayName = 'Sector';

  static propTypes = {
    ...PRESENTATION_ATTRIBUTES,
    className: PropTypes.string,
    cx: PropTypes.number,
    cy: PropTypes.number,
    innerRadius: PropTypes.number,
    outerRadius: PropTypes.number,
    startAngle: PropTypes.number,
    endAngle: PropTypes.number,
    cornerRadius: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  };

  static defaultProps = {
    cx: 0,
    cy: 0,
    innerRadius: 0,
    outerRadius: 0,
    startAngle: 0,
    endAngle: 0,
    cornerRadius: 0,
  };

  render() {
    const { cx, cy, innerRadius, outerRadius, cornerRadius, forceCornerRadius, startAngle, endAngle,
      className } = this.props;

    if (outerRadius < innerRadius || startAngle === endAngle) { return null; }

    const layerClass = classNames('recharts-sector', className);
    const deltaRadius = outerRadius - innerRadius;
    const cr = getPercentValue(cornerRadius, deltaRadius, 0, true);
    let path;

    if (cr > 0 && Math.abs(startAngle - endAngle) < 360) {
      path = getSectorWithCorner({
        cx, cy, innerRadius, outerRadius,
        cornerRadius: Math.min(cr, deltaRadius / 2),
        forceCornerRadius,
        startAngle, endAngle,
      });
    } else {
      path = getSectorPath({ cx, cy, innerRadius, outerRadius, startAngle, endAngle });
    }

    return (
      <path
        {...getPresentationAttributes(this.props)}
        {...filterEventAttributes(this.props)}
        className={layerClass}
        d={path}
      />
    );
  }
}

export default Sector;
