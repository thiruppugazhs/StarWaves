import os
from PIL import Image

source_img_path = r"C:\Users\susin\.gemini\antigravity\brain\a1b59300-cdff-427f-a888-ed97b15806bb\.user_uploaded\media__1784904478836.png"

if os.path.exists(source_img_path):
    img = Image.open(source_img_path).convert("RGBA")
    
    width, height = img.size
    side = min(width, height)
    left = (width - side) // 2
    top = (height - side) // 2
    img_cropped = img.crop((left, top, left + side, top + side))

    icon_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "website"))
    targets = [
        os.path.join(base_dir, "favicon.ico"),
        os.path.join(base_dir, "public", "favicon.ico"),
        os.path.join(base_dir, "public", "favicon.png"),
        os.path.join(base_dir, "public", "starwaves-logo.png")
    ]
    
    dist_dir = os.path.join(base_dir, "dist")
    if os.path.exists(dist_dir):
        targets.append(os.path.join(dist_dir, "favicon.ico"))
        targets.append(os.path.join(dist_dir, "favicon.png"))

    for target in targets:
        os.makedirs(os.path.dirname(target), exist_ok=True)
        if target.endswith(".ico"):
            img_cropped.save(target, format="ICO", sizes=icon_sizes)
        else:
            img_cropped.save(target, format="PNG")
            
    print("Successfully processed user uploaded image into favicon.ico and PNG files!")
else:
    print("Source image not found:", source_img_path)
