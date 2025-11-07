import azure.functions as func
import pandas as pd
import json
import time
import logging
#from azure.storage.blob import BlobServiceClient
import io
import os


app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

def get_blob_data():
    
    """
    try:
        connection_string = os.environ["AzureWebJobsStorage"]
        container_name = "diet-data"
        blob_name = "All_Diets.csv"

        blob_service_client = BlobServiceClient.from_connection_string(connection_string)
        blob_client = blob_service_client.get_blob_client(container=container_name, blob=blob_name)

        blob_data = blob_client.download_blob()
        csv_content = blob_data.readall()

        df = pd.read_csv(io.BytesIO(csv_content))
        return df, None
    except Exception as e:
        logging.error(f"Error reading blob: {str(e)}")
        return None, str(e)
    
    """
    df = pd.read_csv("All_Diets.csv")
    return df, None
    
    
    
def perform_data_analysis(df):
    for col in ['Protein(g)', 'Carbs(g)', 'Fat(g)']:
        df[col] = pd.to_numeric(df[col], errors='coerce')

    df.fillna(df.mean(numeric_only=True), inplace=True)

    avg_macros = df.groupby('Diet_type')[['Protein(g)', 'Carbs(g)', 'Fat(g)']].mean().reset_index()

    top_protein = df.sort_values('Protein(g)', ascending=False).groupby('Diet_type').head(5)

    highest_protein_diet = avg_macros.loc[avg_macros['Protein(g)'].idxmax()]
    highest_protein_str = f"{highest_protein_diet['Diet_type']} ({highest_protein_diet['Protein(g)']:2f}g)"


    common_cuisines_df = df.groupby('Diet_type')['Cuisine_type'].apply(lambda x: x.mode()[0] if len(x.mode()) > 0 else 'Unknown').reset_index()
    common_cuisines_map = common_cuisines_df.set_index('Diet_type')['Cuisine_type'].to_dict()

    df['Protein_to_Carbs_ratio'] = df['Protein(g)'] / df['Carbs(g)']

    diet_distribution = df['Diet_type'].value_counts().reset_index()
    diet_distribution.columns = ['diet_type', 'count']
    diet_distribution_list = diet_distribution.to_dict(orient='records')

    avg_macros_list = avg_macros.to_dict(orient='records')
    top_protein_list = top_protein[['Recipe_name', 'Protein(g)', 'Cuisine_type', 'Diet_type']].to_dict(orient='records')

    total_recipes = len(df)
    total_unique_diets = df['Diet_type'].nunique()
    overall_avg_protein = df['Protein(g)'].mean()
    overall_avg_carbs = df['Carbs(g)'].mean()
    overall_avg_fat = df['Fat(g)'].mean()

    api_payload = {
        "title": "Diet and Macro-Nutrient Analysis Results",
        "summary": [
            {"label": "Total Recipes analyzed", "value": f"{total_recipes}"},
            {"label": "Unique Diet Types", "value": f"{total_unique_diets}"},
            {"label": "Overall Avg. Protein (g)", "value":f"{overall_avg_protein:.2f}"},
            {"label": "Overall Avg. Carbs (g)", "value":f"{overall_avg_carbs:.2f}"},
            {"label": "Overall Avg. Fat (g)", "value":f"{overall_avg_fat:.2f}"}
        ],
        "dataVisualizations": {
            "avgMacros": avg_macros_list,
            "topProteinRecipes": top_protein_list,
            "dietDistribution": diet_distribution_list
        },
        "metadata": {
            "highestProteinDiet": highest_protein_str,
            "commonCuisines": common_cuisines_map
        }
    }

    return api_payload

@app.route(route="analyze", methods=["GET"])
def analyze_data(req: func.HttpRequest) -> func.HttpResponse:

    logging.info('Processing diet analysis request')

    start_time = time.time()

    try:
        df, error = get_blob_data()

        if error:
            return func.HttpResponse(
                json.dumps({"error": f"Failed to retrieved data from blob storage: {error}"}),
                status_code=500,
                mimetype="application/json",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-allow-Headers": "Content-Type"
                }
            )
        result = perform_data_analysis(df)

        end_time = time.time()
        execution_time_ms = round((end_time - start_time) * 1000, 2)
        result['executionTimeMs'] = execution_time_ms

        return func.HttpResponse(
            json.dumps(result), 
            status_code=200, 
            mimetype="application/json",
            headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-allow-Headers": "Content-Type"
                }
        )
    
    except Exception as e:
        logging.error(f"Error during analysis: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": f"Analysis failed: {str(e)}"}),
            status_code=500,
            mimetype="application/json",
            headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-allow-Headers": "Content-Type"
                }
        )
    
@app.route(route="analyze", methods=["OPTIONS"])
def analyze_options(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse(
        "",
        status_code=200, 
        headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-allow-Headers": "Content-Type"
                }
    )