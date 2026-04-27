#!/usr/bin/env python3
"""
FVC Dataset Automatic Labeling and Report Generation
Analyzes fingerprint images, detects pattern type, extracts minutiae, and creates labeled reports.
"""

import os
import json
from pathlib import Path
from PIL import Image
import numpy as np
import cv2
from tqdm import tqdm
from typing import Dict, List, Tuple, Any

class FingerprintLabeler:
    def __init__(self, dataset_path: str):
        """Initialize the fingerprint labeler with FVC dataset path."""
        self.dataset_path = Path(dataset_path)
        self.labels = {}
        self.reports = {}
        
        # Pattern classification thresholds
        self.pattern_types = ["whorl", "ulnar_loop", "radial_loop", "plain_arch", "tented_arch", "accidental"]
        
    def load_image(self, image_path: str) -> np.ndarray:
        """Load TIFF image as grayscale numpy array."""
        try:
            img = Image.open(image_path).convert('L')
            return np.array(img, dtype=np.uint8)
        except Exception as e:
            print(f"Error loading {image_path}: {e}")
            return None
    
    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Preprocess fingerprint image for analysis."""
        if image is None:
            return None
        
        # Normalize
        image = cv2.normalize(image, None, 0, 255, cv2.NORM_MINMAX)
        
        # Enhance contrast
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(image)
        
        return enhanced
    
    def extract_orientation_field(self, image: np.ndarray, block_size: int = 16) -> np.ndarray:
        """Extract ridge orientation field."""
        if image.shape[0] < block_size or image.shape[1] < block_size:
            return np.zeros((image.shape[0] // block_size, image.shape[1] // block_size))
        
        orientations = np.zeros((image.shape[0] // block_size, image.shape[1] // block_size))
        
        for i in range(0, image.shape[0] - block_size, block_size):
            for j in range(0, image.shape[1] - block_size, block_size):
                block = image[i:i+block_size, j:j+block_size]
                
                # Compute gradients
                gx = cv2.Sobel(block, cv2.CV_32F, 1, 0, ksize=3)
                gy = cv2.Sobel(block, cv2.CV_32F, 0, 1, ksize=3)
                
                # Compute orientation
                orientation = np.arctan2(gy, gx)
                orientations[i//block_size, j//block_size] = np.mean(orientation)
        
        return orientations
    
    def find_core_delta(self, orientations: np.ndarray) -> Tuple[Tuple[int, int], List[Tuple[int, int]]]:
        """Estimate core and delta positions from orientation field."""
        # Simplified: assume core is near center, find deltas at extremes
        h, w = orientations.shape
        core = (h // 2, w // 2)
        
        # Delta positions (simplified detection)
        deltas = []
        
        # Check for typical delta patterns
        if h > 0 and w > 0:
            # Upper left region
            ul_variance = np.var(orientations[:h//3, :w//3])
            if ul_variance > 0.1:
                deltas.append((h//6, w//6))
            
            # Upper right region
            ur_variance = np.var(orientations[:h//3, 2*w//3:])
            if ur_variance > 0.1:
                deltas.append((h//6, 5*w//6))
        
        return core, deltas
    
    def classify_pattern(self, image: np.ndarray, orientations: np.ndarray, core: Tuple[int, int], deltas: List[Tuple[int, int]]) -> str:
        """Classify fingerprint pattern type."""
        num_deltas = len(deltas)
        
        # Pattern detection heuristics
        if num_deltas == 0:
            # Arch patterns (no delta)
            # Check if core has sharp angle = Tented, gentle = Plain
            if orientations.shape[0] > 0 and orientations.shape[1] > 0:
                core_orientation = orientations[min(core[0], orientations.shape[0]-1), min(core[1], orientations.shape[1]-1)]
                if abs(core_orientation) > 0.5:
                    return "tented_arch"
            return "plain_arch"
        
        elif num_deltas == 1:
            # Loop patterns
            # Check if delta is on radial or ulnar side
            delta_x = deltas[0][1] if deltas else 0
            mid_x = image.shape[1] // 2
            
            if delta_x < mid_x:
                return "radial_loop"
            else:
                return "ulnar_loop"
        
        elif num_deltas >= 2:
            # Whorl or complex patterns
            # Check for circular ridge flow
            center_y, center_x = image.shape[0] // 2, image.shape[1] // 2
            region = orientations[max(0, center_y-10):min(orientations.shape[0], center_y+10),
                                  max(0, center_x-10):min(orientations.shape[1], center_x+10)]
            
            if region.size > 0:
                circularity = np.std(region)
                if circularity > 0.3:
                    return "whorl"
            
            return "accidental"
        
        return "ulnar_loop"  # Default fallback
    
    def extract_minutiae(self, image: np.ndarray, block_size: int = 5) -> List[Dict[str, Any]]:
        """Extract minutiae points (ridge endings and bifurcations)."""
        minutiae = []
        
        if image.shape[0] < block_size or image.shape[1] < block_size:
            return minutiae
        
        # Binarize image
        _, binary = cv2.threshold(image, 128, 255, cv2.THRESH_BINARY)
        
        # Thinning (skeletonization)
        kernel = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))
        thinned = cv2.morphologyEx(binary, cv2.MORPH_ERODE, kernel, iterations=1)
        
        # Find minutiae through neighborhood analysis
        h, w = thinned.shape
        
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                if thinned[y, x] > 0:
                    # Get 8-neighborhood
                    neighborhood = thinned[y-1:y+2, x-1:x+2]
                    ridge_count = np.sum(neighborhood > 0)
                    
                    # Ridge ending: 2 neighbors (1 adjacent to center)
                    if ridge_count == 2:
                        minutiae.append({
                            "x": x,
                            "y": y,
                            "type": "ridge_ending",
                            "quality": 0.8,
                            "angle": 0
                        })
                    
                    # Bifurcation: 4+ neighbors
                    elif ridge_count >= 4:
                        minutiae.append({
                            "x": x,
                            "y": y,
                            "type": "bifurcation",
                            "quality": 0.85,
                            "angle": 0
                        })
        
        # Limit to top-quality minutiae
        minutiae = sorted(minutiae, key=lambda m: m['quality'], reverse=True)[:50]
        
        return minutiae
    
    def label_fvc_database(self, db_name: str):
        """Label all images in a single FVC database."""
        db_path = self.dataset_path / db_name
        
        if not db_path.exists():
            print(f"Database {db_name} not found at {db_path}")
            return
        
        print(f"\nProcessing {db_name}...")
        
        # Get all TIFF images
        images = sorted(db_path.glob("*.tif"))
        
        for img_path in tqdm(images, desc=f"Labeling {db_name}"):
            try:
                # Load and preprocess
                image = self.load_image(str(img_path))
                if image is None:
                    continue
                
                enhanced = self.preprocess_image(image)
                
                # Extract features
                orientations = self.extract_orientation_field(enhanced)
                core, deltas = self.find_core_delta(orientations)
                pattern = self.classify_pattern(enhanced, orientations, core, deltas)
                minutiae = self.extract_minutiae(enhanced)
                
                # Calculate quality score
                quality_score = np.mean([m['quality'] for m in minutiae]) if minutiae else 0.5
                
                # Store labels
                img_name = img_path.name
                self.labels[img_name] = {
                    "database": db_name,
                    "pattern_type": pattern,
                    "minutiae_count": len(minutiae),
                    "core_position": {"x": int(core[1]), "y": int(core[0])},
                    "delta_positions": [{"x": int(d[1]), "y": int(d[0])} for d in deltas],
                    "minutiae": minutiae,
                    "quality_score": float(quality_score),
                    "image_size": image.shape
                }
                
            except Exception as e:
                print(f"Error processing {img_path.name}: {e}")
    
    def label_all_databases(self):
        """Label all 4 FVC databases."""
        databases = ["DB1_B", "DB2_B", "DB3_B", "DB4_B"]
        
        for db in databases:
            self.label_fvc_database(db)
    
    def save_labels(self, output_file: str = "fingerprint_labels.json"):
        """Save labels to JSON file."""
        output_path = self.dataset_path.parent / output_file
        
        with open(output_path, 'w') as f:
            json.dump(self.labels, f, indent=2)
        
        print(f"\nLabels saved to {output_path}")
        print(f"Total labeled images: {len(self.labels)}")
        
        # Print summary statistics
        patterns = {}
        total_minutiae = 0
        
        for img_data in self.labels.values():
            pattern = img_data['pattern_type']
            patterns[pattern] = patterns.get(pattern, 0) + 1
            total_minutiae += img_data['minutiae_count']
        
        print(f"\nPattern distribution:")
        for pattern, count in sorted(patterns.items()):
            print(f"  {pattern}: {count} images")
        
        print(f"\nAverage minutiae per image: {total_minutiae / len(self.labels):.1f}")
        
        return output_path
    
    def generate_summary_report(self):
        """Generate a summary report of all labeled images."""
        summary = {
            "total_images": len(self.labels),
            "databases": list(set(img['database'] for img in self.labels.values())),
            "pattern_distribution": {},
            "statistics": {}
        }
        
        for img_data in self.labels.values():
            pattern = img_data['pattern_type']
            summary['pattern_distribution'][pattern] = summary['pattern_distribution'].get(pattern, 0) + 1
        
        minutiae_counts = [img['minutiae_count'] for img in self.labels.values()]
        quality_scores = [img['quality_score'] for img in self.labels.values()]
        
        summary['statistics'] = {
            "avg_minutiae": np.mean(minutiae_counts),
            "min_minutiae": int(np.min(minutiae_counts)),
            "max_minutiae": int(np.max(minutiae_counts)),
            "avg_quality": np.mean(quality_scores),
        }
        
        return summary


def main():
    """Main execution."""
    dataset_path = r"d:\Pratyaksh-main\client\Fingerprint_Dataset"
    
    print("FVC Dataset Automatic Labeling Tool")
    print("=" * 50)
    
    labeler = FingerprintLabeler(dataset_path)
    labeler.label_all_databases()
    output_file = labeler.save_labels("fingerprint_labels.json")
    
    summary = labeler.generate_summary_report()
    print("\nSummary Report:")
    print(json.dumps(summary, indent=2))
    
    print(f"\n✅ Labeling complete! Labels saved to {output_file}")


if __name__ == "__main__":
    main()
