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
 /**
         * Get the color hierarchy.
         */
        const colorHierarchy = await dataView.hierarchy("Color");
        const colorLeafNodes = (await colorHierarchy.root()).leaves();
        const colorDomain = colorHierarchy.isEmpty
            ? ["All Values"]
            : colorLeafNodes.map((node) => node.formattedPath());
         

            
        const xHierarchy = await dataView.hierarchy("From");
        const xGroup = (await xHierarchy.root()).leaves();
        
        const pointsTable = createTable(createPoint)(allRows, !xHierarchy.isEmpty, !colorHierarchy.isEmpty);


        const dataColumns = [
            "Colors",
            ...colorDomain.flatMap((color) => [{ label: color, type: "number" }, { role: "style" }])
        ];
        
        //get the colors of the groups
        let colorgroup = xGroup.map((leaf) => {
            var color;
            leaf.rows().forEach((r) => {
                let colorIndex = !colorHierarchy.isEmpty ? r.categorical("Color").leafIndex : 0;
                color = r.color().hexCode;
            });
            var row = [ color,color];
            return row;
        });

        function addColors(xGroups,colorgroup)
        {return(
            xGroups.map(function(d,i) {
              return {
                key: d.key.toUpperCase(),
                index: i + 1,
                colors  : colorgroup[i]
              };
            })
            )
        }

        var smallteamsdata=addColors(xGroup,colorgroup);
       
        var matrixRows = new Array(xGroup.length).fill([0]).flat();
        var matrixColums = new Array(xGroup.length).fill([0]).flat();
        //create the matrix -> for each pair of import export
        let dataRows = matrixRows.map((row) => {
            return matrixColums.flat();
        });

       
        allRows.forEach(row => {
           
            var from=row.categorical('From').leafIndex;
            var to=row.categorical('To').leafIndex;
            var value = row.continuous('Y').value();
            console.log(from+' '+to);
            dataRows[from][to] = value;
             
        });

        console.log('matrix');
        console.log(dataRows); 

        
        const margin = { top: 70, right: 40, bottom: 70, left: 80 };
       
        
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
          

        /*replacing Observable runtime objects to Spotfire objects*/
          main.redefine("teams",smallteamsdata );
          main.redefine("M",dataRows );
 
    }
};

/**
 * Trigger init
 */
Spotfire.initialize(init);
