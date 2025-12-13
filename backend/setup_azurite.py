from azure.storage.blob import BlobServiceClient

# Connect to Azurite
connection_string = "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;"

blob_service_client = BlobServiceClient.from_connection_string(connection_string)

# Create container
container_client = blob_service_client.create_container("diet-data")
print("Container 'diet-data' created!")

# Upload your CSV
with open("All_Diets.csv", "rb") as data:
    blob_client = blob_service_client.get_blob_client(container="diet-data", blob="All_Diets.csv")
    blob_client.upload_blob(data)
    print("All_Diets.csv uploaded!")