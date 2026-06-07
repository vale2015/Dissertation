from app import create_app

# Create the Flask application using the application factory.
app = create_app()

# Run the backend server only when this file is executed directly.
if __name__ == "__main__":
    print("Starting Flask...")
    app.run(host="127.0.0.1", port=5000, debug=True)