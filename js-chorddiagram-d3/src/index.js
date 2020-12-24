/*
 * Copyright © 2020. TIBCO Software Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

//@ts-check

// Manually import the array polyfills because the API is using functions not supported in IE11.
import "core-js/es/array";

//@ts-ignore
import * as d3 from 'd3';

import {
    createTable,
    createPoint,
    createGroup,
    markGroup,
    invalidateTooltip
} from "./extended-api.js";

const Spotfire = window.Spotfire;
const DEBUG = false;

const container = d3.select("#mod-container");

/**
 * @type {Spotfire.OnLoadCallback}
 */
const init = async (mod) => {
    /**
     * Read metadata and write mod version to DOM
     */
    const modMetaData = mod.metadata;
    console.log("Mod version:", modMetaData.version ? "v" + modMetaData.version : " unknown version");

    /**
     * Initialize render context - should show 'busy' cursor.
     * A necessary step for printing (another step is calling render complete)
     */
    const context = mod.getRenderContext();

    const styling = context.styling;
    const { tooltip, popout } = mod.controls;
    const { radioButton } = popout.components;
    const { section } = popout;

    let state = { render: true };
    const setState = ({ dragSelectActive }) => {
        state = { ...state, render: dragSelectActive != true };
    };

    /**
     * Create reader function which is actually a one time listener for the provided values.
     * @type {Spotfire.Reader}
     */
    const reader = mod.createReader(
        mod.visualization.data(),
        mod.windowSize(),
        mod.property("tooltiptext")
    );

    /**
     * Creates a function that is part of the main read-render loop.
     * It checks for valid data and will print errors in case of bad data or bad renders.
     * It calls the listener (reader) created earlier and adds itself as a callback to complete the loop.
     * @param {Spotfire.DataView} dataView
     * @param {Spotfire.Size} windowSize
     * @param {Spotfire.AnalysisProperty<string>} tooltiptext
     
     */
    const onChange = async (dataView, windowSize, tooltiptext) => {
        try {
            invalidateTooltip(tooltip);

            await render({
                dataView,
                windowSize,
                tooltiptext

            });
            context.signalRenderComplete();

            // Everything went well this time. Clear any error.
            mod.controls.errorOverlay.hide("catch");
        } catch (e) {
            mod.controls.errorOverlay.show(
                e.message || e || "☹️ Something went wrong, check developer console",
                "catch"
            );
            if (DEBUG) {
                throw e;
            }
        }
    };

    /**
     * Initiates the read-render loop
     */
    reader.subscribe(onChange);

    /**
     * Renders the chart.
     * @param {RenderOptions} options - Render Options
     * @typedef {Object} RenderOptions
     * @property {Spotfire.DataView} dataView - dataView
     * @property {Spotfire.Size} windowSize - windowSize
     * @property {Spotfire.AnalysisProperty<string>} tooltiptext - tooltiptext
     */
    async function render({ dataView, windowSize, tooltiptext }) {
        let width = windowSize.width;

        /**
         * The DataView can contain errors which will cause rowCount method to throw.
         */
        let errors = await dataView.getErrors();
        if (errors.length > 0) {
            // Data view contains errors. Display these and clear the chart to avoid
            // getting a flickering effect with an old chart configuration later (TODO).
            mod.controls.errorOverlay.show(errors, "dataView");
            return;
        }

        mod.controls.errorOverlay.hide("dataView");


        /**
            // Return and wait for next call to render when reading data was aborted.
            // Last rendered data view is still valid from a users perspective since
            // a document modification was made during a progress indication.
         * Hard abort if row count exceeds an arbitrary selected limit
         */
        const rowCount = await dataView.rowCount();
        const limit = 1500;
        if (rowCount > limit) {
            mod.controls.errorOverlay.show(
                `☹️ Cannot render - too many rows (rowCount: ${rowCount}, limit: ${limit}) `,
                "rowCount"
            );
            return;
        } else {
            mod.controls.errorOverlay.hide("rowCount");
        }

        if (state.render === false) {
            return;
        }

        const allRows = await dataView.allRows();
        if (allRows == null) {
            // Return and wait for next call to render when reading data was aborted.
            // Last rendered data view is still valid from a users perspective since
            // a document modification was made during a progress indication.
            return;
        }
        const yAxisMeta = await mod.visualization.axis("Y");


        const xHierarchy = await dataView.hierarchy("From");
        const colorHierarchy = await dataView.hierarchy("Color");

        const xGroup = (await xHierarchy.root()).leaves();
        const colorGroup = (await colorHierarchy.root()).leaves();

        const pointsTable = createTable(createPoint)(allRows, !xHierarchy.isEmpty, !colorHierarchy.isEmpty);
        const colorTable = createTable(createGroup)(colorGroup, !xHierarchy.isEmpty, !colorHierarchy.isEmpty);
        const xTable = createTable(createGroup)(xGroup, !xHierarchy.isEmpty, !colorHierarchy.isEmpty);

        //usable groups
        const groups = xTable.values.map(createTempGroup_placeholder);

        function createTempGroup_placeholder({ points, name = "", sum = 0, id, formattedValues }) {
            const rows = points.map(pointsTable.select);
            const rowsMarked = rows.filter((row) => row.marked);
            const rowsUnmarked = rows.filter((row) => !row.marked);
            const color = [((rowsMarked.length && rowsMarked[0]).hexCode || "gray")];
            const isMarked = (rowsMarked.length > 0);
            //quick fix to see marking effects
            color[0] = (rowsMarked.length > 0) ? ((rowsMarked.length && rowsMarked[0]).hexCode) : ((rowsUnmarked.length && rowsUnmarked[0]).hexCode);
            return { name, rows, color, sum, id, formattedValues, isMarked };
        }

        let colorsScale =
            d3
                .scaleOrdinal()
                .domain(groups.map(d => d.name))
                .range(groups.map(d => d.color));

        var matrixRows = new Array(xGroup.length).fill([0]).flat();
        var matrixColums = new Array(xGroup.length).fill([0]).flat();
        //create the matrix -> for each pair of import export
        let M = matrixRows.map((row) => {
            return matrixColums.flat();
        });

        allRows.forEach(row => {

            var from = row.categorical('From').leafIndex;
            var to = row.categorical('To').leafIndex;
            var value = row.continuous('Y').value();
            M[from][to] = value;

        });

        allRows.forEach(row => {

            var from = row.categorical('From').leafIndex;
            var to = row.categorical('To').leafIndex;
            var value = row.continuous('Y').value();
            M[from][to] = value;

        });

        var result = [];
        allRows.reduce(function (res, value) {
            if (!res[value.categorical('From').leafIndex]) {
                res[value.categorical('From').leafIndex] = { Id: value.categorical('From').leafIndex, val: 0 };
                result.push(res[value.categorical('From').leafIndex])
            }
            res[value.categorical('From').leafIndex].val += value.continuous('Y').value();
            return res;
        }, {});

        const maxofResult = result.reduce((sum, currentValue) => {
            return Math.max(sum, currentValue.val);
        }, 0);

        const radiusunit = 30;
        const s = 10;

        var textLength = (Math.max(...xTable.keys.map(d => { return d.length })) * styling.scales.font.fontSize / 3);
        var r = Math.min(innerWidth, innerHeight) * 0.5 - s - textLength - radiusunit;

        var chords =
            d3.chord().sortSubgroups(d3.descending)
                .padAngle(0.05)
                (M);

        container.attr("viewBox", [0, 0, windowSize.width, windowSize.height]);
        container.selectAll("*").remove();

        let svg = container
            .append("svg")
            .style('background-color', 'white')
            .attr("viewBox", [-0.5 * width, -0.5 * innerHeight, 1 * width, innerHeight * 1])
            .attr("font-size", 10)
            .attr("font-family", "sans-serif")
            .on('click', function (d) {
                let e = d3.event;
                if (e.target === document.querySelector("svg")) {
                    dataView.clearMarking();
                }
            })
            ;

        let arcs = svg
            .append("g")
            .selectAll("g")
            .data(chords.groups)
            .join("g");
        arcs
            .append("path")
            .attr("fill", d => (colorsScale(groups[d.index].name)[0]))
            .attr("stroke", d => d3.rgb((colorsScale(groups[d.index].name)[0])).darker())
            .attr("d",
                d3
                    .arc()
                    .innerRadius(r)
                    .outerRadius(function (d) {
                        return r + Math.round(d3.sum(M[d.index])) / maxofResult * radiusunit;
                    })
            )
            .on("click", function (d) {
                markGroup(xTable)(xTable.keys[d.index])(d3.event);
            })
            .on("mouseover", function (d) {
                let name = groups[d.index].name.replace(/ /g, '');
                let exported = Math.round(d3.sum(M[d.index]));
                let imported = Math.round(d3.sum(M.map(r => r[d.index])));
                tooltip.show(
                    `${name} -> : ${exported} ${yAxisMeta.parts[0].displayName}\n${name} <- : ${imported} ${yAxisMeta.parts[0].displayName}.`);

            })
            .on("mouseout", function () {
                tooltip.hide();
            })
            .on('mouseenter', function (d) {
                let this_class = '.' + groups[d.index].name.replace(/ /g, '');
                svg.selectAll('.chord').attr('opacity', 0.1);
                svg.selectAll(this_class).attr('opacity', 1);
            })
            .on('mouseleave', function () {
                svg.selectAll('.chord').attr('opacity', 1);
            })
            ;

        let arcs2 = svg
            .append("g")
            .selectAll("g")
            .data(chords.groups)
            .join("g");
        arcs2
            .append("path")
            .attr("fill", d => d3.rgb((colorsScale(groups[d.index].name)[0])).darker())
            .attr("stroke", d => d3.rgb((colorsScale(groups[d.index].name)[0])).darker())
            .attr("d",
                d3
                    .arc()
                    .innerRadius(function (d) {
                        return r + Math.round(d3.sum(M[d.index])) / maxofResult * radiusunit;
                    })
                    .outerRadius(function (d) {

                        return r + Math.round(d3.sum(M[d.index])) / maxofResult * radiusunit + Math.round(d3.sum(M.map(r => r[d.index]))) / maxofResult * radiusunit;
                    })
            )
            .on("click", function (d) {
                markGroup(xTable)(xTable.keys[d.index])(d3.event);
            })
            .on("mouseover", function (d) {
                let name = groups[d.index].name.replace(/ /g, '');
                let exported = Math.round(d3.sum(M[d.index]));
                let imported = Math.round(d3.sum(M.map(r => r[d.index])));
                tooltip.show(
                    `${name} -> : ${exported} ${yAxisMeta.parts[0].displayName}\n${name} <- : ${imported} ${yAxisMeta.parts[0].displayName}.`);

            })
            .on("mouseout", function () {
                tooltip.hide();
            })
            .on('mouseenter', function (d) {
                let this_class = '.' + groups[d.index].name.replace(/ /g, '');
                svg.selectAll('.chord').attr('opacity', 0.1);
                svg.selectAll(this_class).attr('opacity', 1);
            })
            .on('mouseleave', function () {
                svg.selectAll('.chord').attr('opacity', 1);
            })
            .on('clicked', function (d) {
                markGroup(colorTable)(d)(d3.event);
            })

        const group = svg.append("g")
            .attr("font-size", styling.scales.font.fontSize)
            .attr("font-family", styling.scales.font.fontFamily)
            .attr("background", "white")
            .selectAll("g")
            .data(chords.groups)
            .join("g");

        group.append("text")
            .each(d => (d.angle = (d.startAngle + d.endAngle) / 2))
            .attr("transform", d => `
        rotate(${(d.angle * 180 / Math.PI - 90)})
        translate(${r + Math.round(d3.sum(M[d.index])) / maxofResult * radiusunit + Math.round(d3.sum(M.map(r => r[d.index]))) / maxofResult * radiusunit + 5})
        ${d.angle > Math.PI ? "rotate(180)" : ""}
      `)
            .attr("text-anchor", d => d.angle > Math.PI ? "end" : null)
            .text(d => groups[d.index].name)

            .on("click", function (d) {
                markGroup(xTable)(xTable.keys[d.index])(d3.event);
            })
            .on("mouseover", function ({ formattedValues }) {
                tooltip.show(formattedValues);
            })
            .on("mouseout", function () {
                tooltip.hide();
            });


        let ribbons = svg
            .append("g")
            .attr('opacity', 0.7)
            .selectAll("path")
            .data(chords)
            .join("path")
            .attr("d", d3.ribbon().radius(r - 5))
            .attr('class', function (d) {
                let item1 = groups[d.source.index].name.replace(/ /g, '');
                let item2 = groups[d.target.index].name.replace(/ /g, '');
                return `chord ${item1} ${item2}`;
            })
            .attr("fill", d => {
                if (groups[d.target.index].isMarked)
                    return colorsScale(groups[d.target.index].name)[0];
                return colorsScale(groups[d.source.index].name)[0];
            })
            .attr("stroke", d => d3.rgb((colorsScale(groups[d.source.index].name)[0])).darker())
            .on('mouseenter', function () {
                svg.selectAll('.chord').attr('opacity', 0.1);
                d3.select(this).attr('opacity', 1);
            })
            .on('mouseleave', function () {
                svg.selectAll('.chord').attr('opacity', 1);
            })
            .on("mouseover", function (d) {
                let imported1 = Math.round(M[d.source.index][d.target.index]);
                let imported2 = Math.round(M[d.target.index][d.source.index]);
                let item1 = groups[d.source.index].name;
                let item2 = groups[d.target.index].name;
                tooltip.show(`${item1} -> ${item2} : ${imported1} ${yAxisMeta.parts[0].displayName}\n${item2} -> ${item1} : ${imported2} ${yAxisMeta.parts[0].displayName}`);
            })
            .on("mouseout", function () {
                tooltip.hide();
            });




    };



}


/**
 * Trigger init
 */
Spotfire.initialize(init);
