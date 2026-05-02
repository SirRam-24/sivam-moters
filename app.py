import os
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, session, flash
from werkzeug.utils import secure_filename
from pymongo import MongoClient
from bson.objectid import ObjectId
from dotenv import load_dotenv
import cloudinary
import cloudinary.uploader
import cloudinary.api

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'sri_sivam_super_secret_key')

# Cloudinary Configuration
cloudinary.config(
    cloud_name="dbrmvywb0",
    api_key="799647841433247",
    api_secret="XLtCOYXxRTnjZqwaF2oFnQ0AK7k"
)

# MongoDB Configuration
client = MongoClient('mongodb+srv://sriram:1324sriram@cluster0.cco8c4s.mongodb.net/Sivam')
db = client['sivam_motors']
cars_collection = db['cars']
contacts_collection = db['contacts']

# Upload Configuration
UPLOAD_FOLDER = 'static/uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Admin Credentials
ADMIN_USERNAME = 'admin'
ADMIN_PASSWORD = 'password123'

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    cars = list(cars_collection.find().limit(6))
    return render_template('index.html', cars=cars)

@app.route('/contact', methods=['GET', 'POST'])
def contact():
    if request.method == 'POST':
        name = request.form.get('name')
        phone = request.form.get('phone')
        message = request.form.get('message')
        
        contacts_collection.insert_one({
            'name': name,
            'phone': phone,
            'message': message,
            'created_at': datetime.now()
        })
        flash('Thank you for reaching out! We will contact you soon.', 'success')
        return redirect(url_for('contact'))
        
    return render_template('contact.html')

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session['admin_logged_in'] = True
            return redirect(url_for('admin_dashboard'))
        else:
            flash('Invalid credentials', 'error')
            
    return render_template('admin_login.html')

@app.route('/admin/logout')
def admin_logout():
    session.pop('admin_logged_in', None)
    return redirect(url_for('admin_login'))

@app.route('/admin')
def admin_dashboard():
    if not session.get('admin_logged_in'):
        return redirect(url_for('admin_login'))
        
    contacts = list(contacts_collection.find().sort('created_at', -1))
    cars = list(cars_collection.find().sort('created_at', -1))
    return render_template('admin_dashboard.html', contacts=contacts, cars=cars)

@app.route('/admin/add_car', methods=['POST'])
def add_car():
    if not session.get('admin_logged_in'):
        return redirect(url_for('admin_login'))
        
    name = request.form.get('name')
    price = request.form.get('price')
    car_type = request.form.get('type')
    
    file = request.files.get('image')
    if file and allowed_file(file.filename):
        try:
            # Upload to Cloudinary
            upload_result = cloudinary.uploader.upload(file)
            
            cars_collection.insert_one({
                'name': name,
                'price': price,
                'type': car_type,
                'image_url': upload_result.get('secure_url'),
                'cloudinary_public_id': upload_result.get('public_id'),
                'created_at': datetime.now()
            })
            flash('Car added successfully!', 'success')
        except Exception as e:
            flash(f'Error uploading to Cloudinary: {str(e)}', 'error')
    else:
        flash('Invalid image format. Allowed formats: png, jpg, jpeg, webp', 'error')
        
    return redirect(url_for('admin_dashboard'))

@app.route('/admin/delete_car/<car_id>', methods=['POST'])
def delete_car(car_id):
    if not session.get('admin_logged_in'):
        return redirect(url_for('admin_login'))
        
    car = cars_collection.find_one({'_id': ObjectId(car_id)})
    if car:
        # Delete image from Cloudinary if public_id exists
        public_id = car.get('cloudinary_public_id')
        if public_id:
            try:
                cloudinary.uploader.destroy(public_id)
            except Exception:
                pass
        # Fallback for old local images
        elif car.get('image_path'):
            try:
                os.remove(os.path.join('static', car['image_path']))
            except Exception:
                pass
                
        cars_collection.delete_one({'_id': ObjectId(car_id)})
        flash('Car deleted successfully', 'success')
        
    return redirect(url_for('admin_dashboard'))

if __name__ == '__main__':
    # Ensure upload folder exists
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    app.run(debug=True)
