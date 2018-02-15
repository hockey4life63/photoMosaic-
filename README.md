# CLI Photo Mosaic App
This application can be used to analyze images and build a simple color profile of each image into a mongodb collection.
it can also to be used to analyze a photo and build a mosaic of it using the previously analyzed photos

## Dependencies
    * canvas-prebuilt(or canvas with JPEG support)
    * inquirer
    * mongoose
    * progress
    * sharp
    
## Requires a large volume of photos over 100k(a mosaic using a grid of 128x128 photos will have over 40k photos!)
### Analyzing photos and building a mosaic can be very slow (tested at ~9photo processed per sec currrently/~2min per 1k photos on my laptop) building mosaic can be similiar speeds but currently is using 2 seprate loops so has doubled the time.
  
