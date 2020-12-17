export default function define(runtime, observer) {
  const main = runtime.module();

  main.variable(observer("chart")).define("chart", ["d3","width","height","chord","M","team_colors","arc","r_out","teams","arc_tip","tippy","ribbon"], function(d3,width,height,chord,M,team_colors,arc,r_out,teams,arc_tip,tippy,ribbon)
{
   let w=0.7;
  let container = d3.create('div');
            ;
  let svg = container
    .append("svg")
    .style('background-color', 'white')
    .attr("viewBox", [-0.5 * width, -0.5 * innerHeight, 1 * width, innerHeight*1])
    .attr("font-size", 10)
    .attr("font-family", "sans-serif");

  let chords = chord(M);
  let arcs = svg
    .append("g")
    .selectAll("g")
    .data(chords.groups)
    .join("g");
  arcs
    .append("path")
    .attr("fill", d => team_colors(d.index)[1])
    .attr("stroke", d => d3.rgb(team_colors(d.index)[1]).darker())
    .attr("d", arc)
  ;
   const group = svg.append("g")
      .attr("font-size", 12)
      .attr("font-family", "sans-serif")
    .selectAll("g")
    .data(chords.groups)
    .join("g");
  group.append("text")
      .each(d => (d.angle = (d.startAngle + d.endAngle) / 2))
      .attr("transform", d => `
        rotate(${(d.angle * 180 / Math.PI - 90)})
        translate(${r_out + 5})
        ${d.angle > Math.PI ? "rotate(180)" : ""}
      `)
      .attr("text-anchor", d => d.angle > Math.PI ? "end" : null)
      .text(d => teams[d.index].key);

  //overlays the arc for tooltip not sure why this is needed
let tooltip = arcs
    .append("path")
    .attr("fill", d => team_colors(d.index)[1])
    .attr("stroke", d => d3.rgb(team_colors(d.index)[1]).darker())
    .attr("d", arc_tip)
    .on('mouseenter', function(d) {
      let this_class = '.' + teams[d.index].key.replace(/ /g, '');
      svg.selectAll('.chord').attr('opacity', 0.1);
      svg.selectAll(this_class).attr('opacity', 1);
    })
    .on('mouseleave', function() {
      svg.selectAll('.chord').attr('opacity', 1);
    })
    .attr('title', function(d) {
      let key = teams[d.index].key;
      let imported = d3.sum(M[d.index]);
      let exported = d3.sum(M.map(r => r[d.index]));
      return `${key} importeerde ${imported} kg uit het buitenland en exporteerde ${exported} kg naar het buitenland.`;
    }); 

  tooltip.nodes().forEach(e =>
    tippy(e, {
      delay: [200, 100],
      duration: [100, 50],
    followCursor:true
    })
  );
  let ribbons = svg
    .append("g")
    .attr('opacity', 0.7)
    .selectAll("path")
    .data(chords)
    .join("path")
    .attr("d", ribbon)
    .attr('class', function(d) {
      let team1 = teams[d.source.index].key.replace(/ /g, '');
      let team2 = teams[d.target.index].key.replace(/ /g, '');
      return `chord ${team1} ${team2}`;
    })
    .attr("fill", d => team_colors(d.source.index)[0])
    .attr("stroke", d => d3.rgb(team_colors(d.source.index)[0]).darker())
    .on('mouseenter', function() {
      svg.selectAll('.chord').attr('opacity', 0.1);
      d3.select(this).attr('opacity', 1);
    })
    .on('mouseleave', function() {
      svg.selectAll('.chord').attr('opacity', 1);
    })
    .attr('title', function(d) {
      let imported1 = M[d.source.index][d.target.index];
      let imported2 = M[d.target.index][d.source.index];
      let team1 = teams[d.source.index].key;
      let team2 = teams[d.target.index].key;
      return `${team1} importeerde ${imported1} kg van ${team2}. ${team2} importeerde ${imported2} kg van ${team1} `;
    });
  ribbons.nodes().forEach(e =>
    tippy(e, {
      delay: [200, 100],
      duration: [100, 50],
      followCursor: true
    })
  );

  return container.node();
 }


);
  main.variable(observer("scale")).define("scale", ["d3","height"], function(d3,height){return(
d3
  .scaleLinear()
  .domain([-1, 1])
  .range([-height / 2, height / 2])
)});
  main.variable(observer("chords")).define("chords", ["chord","M"], function(chord,M){return(
chord(M)
)});
  main.variable(observer("chord")).define("chord", ["d3"], function(d3){return(
d3
  .chord()
  .padAngle(0.05)
  .sortSubgroups(d3.ascending).sortGroups(d3.descending)
)});
  main.variable(observer("arc")).define("arc", ["d3","r","r_out"], function(d3,r,r_out){return(
d3
  .arc()
  .innerRadius(r)
  .outerRadius(r_out)
)});
  main.variable(observer("arc_tip")).define("arc_tip", ["d3","r","r_out"], function(d3,r,r_out){return(
d3
  .arc()
  .innerRadius(r)
  .outerRadius(r_out)
)});
  main.variable(observer("ribbon")).define("ribbon", ["d3","r_out","s"], function(d3,r_out,s){return(
d3.ribbon().radius(r_out-s-5)
)});
  main.variable(observer("team_colors")).define("team_colors", ["d3","teams"], function(d3,teams){return(
d3
  .scaleOrdinal()
  .domain(d3.range(14))
  .range(teams.map(d => d.colors))
)});
  main.variable(observer("s")).define("s", function(){return(
10
)});
  main.variable(observer("r_out")).define("r_out", ["r","s"], function(r,s){return(
r + s
)});
  main.variable(observer("r")).define("r", ["width","height","s"], function(width,height,s){return(
Math.min(width, height) * 0.5 - s - (45*2)
)});
  main.variable(observer("height")).define("height", ["width"], function(width){return(
1 * innerHeight
)});

  main.variable(observer("teams")).define("teams", function(){return(
[
  {leafindex:0,
  key:"Andy"},
  {leafindex:2,
  key:"Boris"},
  {leafindex:3,
  key:"Margo"},
   {leafindex:4,
  key:"Linn"}
 ]
)});
  main.variable(observer("M")).define("M", function(){return(
[
  [0,11,14,1],
  [11,0,1,1],
  [15,7,0,3],
  [15,7,11,0]
  ]
)});
  main.variable(observer("tippy")).define("tippy", ["require"], function(require){return(
require("https://unpkg.com/tippy.js@2.5.4/dist/tippy.all.min.js")
)});
  main.variable(observer("d3")).define("d3", ["require"], function(require){return(
require("d3@5")
)});
  return main;
}
