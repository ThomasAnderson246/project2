import pandas as pd
import json
import time
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)

CORS(app)

DATA_FILE = 'All_Diets.csv'

def perform_data_analysis():
    try:
        df = pd.read_csv(DATA_FILE)
    except FileNotFoundError:
        return {"error": f"Error: the required file '{DATA_FILE}' was not found in the directory."}, 500
    
    for col in ['Protein(g)', 'Carbs(g)', 'Fat(g)']:
        df[col] = pd.to_numeric(df[col], errors='coerce')

    df.fillna(df.mean(numeric_only=True), inplace=True)

    avg_macros = df.groupby('Diet_type')[['Protein(g)', 'Carbs(g)', 'Fat(g)']].mean().reset_index()

    top_protein = df.sort_values('Protein(g)', ascending=False).groupby('Diet_type').head(5)

    highest_protein_diet = avg_macros.loc[avg_macros['Protein(g)'].idxmax()]
    highest_protein_str = f"{highest_protein_diet['Diet_type']} ({highest_protein_diet['Protein(g)']:2f}g)"

    common_cuisines_df = df.groupby('Diet_type')['Cuisine_type'].apply(lambda x: x.mode()[0]).reset_index()
    common_cuisines_map = common_cuisines_df.set_index('Diet_type')['Cuisine_type'].to_dict()

    df ['Protine_to_Carbs_ratio'] = df['Protein(g)'] / df['Carbs(g)']

    avg_macros_list = avg_macros.to_dict(orient='records')

    top_protein_list = top_protein[['Recipe_name', 'Protein(g)', 'Cuisine_type', 'Diet_type']].to_dict(orient='records')

    total_recipes = len(df)
    total_unique_diets = df['Diet_type'].nunique()
    overall_avg_protein = df['Protein(g)'].mean()

    api_payload = {
        "title": "Diet and Macro-Nutrient analysis Results",
        "summary": [
            {"label": "Total Recipes Analyzed", "value":f"{total_recipes:,},"},
            {"label": "Unique Diet Types", "value": f"{total_unique_diets}"},
            {"label": "Overall Avg. Protine(g)", "value": f"{overall_avg_protein:.2f}"},
        ],
        "dataVisualizations": {
            "avgMacros": avg_macros_list,
            "topProteinRecipes": top_protein_list,
        },
        "metadata":{
            "highestProtineDiet": highest_protein_str,
            "commonCuisines": common_cuisines_map
        }
    }

    return api_payload, 200

@app.route('/api/analyze', methods=['GET'])
def analyze_data_route():
    start_time = time.time()

    result, status_code = perform_data_analysis()

    end_time = time.time()
    execution_time_ms = round((end_time - start_time)*1000, 2)

    if status_code == 200:
        result['executionTimeMs'] = execution_time_ms
        return jsonify(result), status_code
    
    else: 
        return jsonify(result), status_code
    

if __name__ == '__main__':
    print("Starting Flask Server....")
    app.run(debug=True, port=5000)


