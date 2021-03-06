/*
 * Copyright © 2020. TIBCO Software Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

//@ts-check

// Manually import the array polyfills because the API is using functions not supported in IE11.
import "core-js/es/array";


//@ts-ignore
import define from "./d3-importexport/d3-importexport.js";
//@ts-ignore
import {Runtime, Inspector} from "@observablehq/runtime";


import { addHandlersSelection } from "./ui-input.js";

import {
    createTable,
    createPoint,
    createGroup,
    axisDisplayName,
    is,
    stack,
    markGroup,
    createTextLine,
    invalidateTooltip
} from "./extended-api.js";

const Spotfire = window.Spotfire;
const DEBUG = false;

/**
 * @type {Spotfire.OnLoadCallback}
 */
const init = async (mod) => {
    /**
     * Read metadata and write mod version to DOM
     */
    const modMetaData = mod.metadata;
    console.log("Mod version:", modMetaData.version ? "v" + modMetaData.version : "unknown version");

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
        mod.property("chartType"),
        mod.property("curveType")
    );

    /**
     * Creates a function that is part of the main read-render loop.
     * It checks for valid data and will print errors in case of bad data or bad renders.
     * It calls the listener (reader) created earlier and adds itself as a callback to complete the loop.
     * @param {Spotfire.DataView} dataView
     * @param {Spotfire.Size} windowSize
     * @param {Spotfire.AnalysisProperty<string>} chartType
     * @param {Spotfire.AnalysisProperty<string>} curveType
     */
    const onChange = async (dataView, windowSize, chartType, curveType) => {
        try {
            invalidateTooltip(tooltip);

            await render({
                dataView,
                windowSize,
                chartType,
                curveType
            });
            context.signalRenderComplete();

            // Everything went well this time. Clear any error.
            mod.controls.errorOverlay.hide("catch");
        } catch (e) {
            mod.controls.errorOverlay.show(
                e.message || e || "☹️ Something went wrong, check developer console",
                "catch"
            );
            if(DEBUG){
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
     * @property {Spotfire.ModProperty<string>} chartType - chartType
     * @property {Spotfire.ModProperty<string>} curveType - curveType
     */
    async function render({ dataView, windowSize, chartType, curveType }) {
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
        const limit = 1250;
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
        const colorHierarchy = await dataView.hierarchy("Color");
        const xHierarchy = await dataView.hierarchy("X");
        const pointsTable = createTable(createPoint)(allRows, !xHierarchy.isEmpty, !colorHierarchy.isEmpty);
        const xGroup = (await xHierarchy.root()).leaves();
        const xTable = createTable(createGroup)(xGroup, !xHierarchy.isEmpty, !colorHierarchy.isEmpty);
        const colorGroup = (await colorHierarchy.root()).leaves();
        const colorTable = createTable(createGroup)(colorGroup, !xHierarchy.isEmpty, !colorHierarchy.isEmpty);

        const normalize = is(chartType)("percentStacked");
        const stacked = normalize || is(chartType)("stacked");

        stacked && stack(pointsTable)(xTable)(normalize);

        const xAxisMeta = await mod.visualization.axis("X");
        const yAxisMeta = await mod.visualization.axis("Y");
        const colorAxisMeta = await mod.visualization.axis("Color");
        const xAxisDisplayNames = axisDisplayName(xAxisMeta);
        const yAxisDisplayNames = axisDisplayName(yAxisMeta);
        const colorAxisDisplayNames = axisDisplayName(colorAxisMeta);

        const margin = { top: 20, right: 40, bottom: 40, left: 80 };
        console.log(xGroup);
        
                /* using D3 ObservableHQ runtime*/
                const runtime = new Runtime();
                const main = runtime.module(define, name => {
                    if (name == 'chart') {
                        return new Inspector(document.querySelector("#mod-container"));
                    }
                    else{
                        return true;
                    }


                  });
          /*connecting Observable runtime objects to Spotfire objects*/
        
          main.redefine("teams",xGroup );
          console.log(allRows);
 
    }
};

/**
 * Trigger init
 */
Spotfire.initialize(init);
